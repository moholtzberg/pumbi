import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { normalizeLotImages } from '$lib/server/lotImages.js';
import { convertImageObjects } from '$lib/utils/s3Presigned.js';
import { deleteFile } from '$lib/services/cloudStorage.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

async function requireLotAccess(locals, lotId) {
  const user = await requireAuthenticatedUser(locals);
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: { auction: true }
  });
  if (!lot) {
    throw error(404, 'Lot not found');
  }
  requireAuctionAccess(user, lot.auction);
  await requireAuctionHousePermission(
    user,
    lot.auction.auctionHouseId,
    HOUSE_PERMISSIONS.MANAGE_CATALOG
  );
  return lot;
}

// Get all images for a lot
export async function GET({ params }) {
  try {
    const images = await prisma.lotImage.findMany({
      where: { lotId: params.id },
      orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }]
    });
    return json(await convertImageObjects(images));
  } catch (err) {
    console.error('Error fetching lot images:', err);
    throw error(500, 'Failed to fetch images');
  }
}

// Add images to a lot
export async function POST({ params, request, locals }) {
  try {
    await requireLotAccess(locals, params.id);
    const { images } = await request.json(); // Array of {url, key, displayOrder?, isPrimary?}
    
    if (!Array.isArray(images) || images.length === 0) {
      throw error(400, 'Images array is required');
    }

    const records = normalizeLotImages(images, { defaultPrimary: false });
    const createdImages = await prisma.$transaction(async tx => {
      if (records.some(image => image.isPrimary)) await tx.lotImage.updateMany({ where: { lotId: params.id, isPrimary: true }, data: { isPrimary: false } });
      const created = [];
      for (const image of records) created.push(await tx.lotImage.create({ data: { lotId: params.id, ...image } }));
      return created;
    });

    return json(createdImages, { status: 201 });
  } catch (err) {
    console.error('Error creating lot images:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to create images');
  }
}

// Update image order and primary status
export async function PATCH({ params, request, locals }) {
  try {
    await requireLotAccess(locals, params.id);
    const { images } = await request.json(); // Array of {id, displayOrder, isPrimary?}
    
    if (!Array.isArray(images) || images.length === 0) {
      throw error(400, 'Images array is required');
    }

    const existingImages = await prisma.lotImage.findMany({
      where: { id: { in: images.map((image) => image.id) }, lotId: params.id },
      select: { id: true }
    });
    if (existingImages.length !== images.length) {
      throw error(404, 'Image not found');
    }

    // Check if any image is being set as primary
    const primaryImage = images.find(img => img.isPrimary);
    if (primaryImage) {
      // Unset all existing primary images for this lot
      await prisma.lotImage.updateMany({
        where: { lotId: params.id, isPrimary: true },
        data: { isPrimary: false }
      });
    }

    // Update each image
    await Promise.all(
      images.map(img =>
        prisma.lotImage.update({
          where: { id: img.id },
          data: {
            displayOrder: img.displayOrder,
            ...(img.isPrimary !== undefined ? { isPrimary: img.isPrimary } : {}),
            ...(img.isHidden !== undefined ? { isHidden: img.isHidden } : {})
          }
        })
      )
    );

    return json({ message: 'Images updated successfully' });
  } catch (err) {
    console.error('Error updating images:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to update images');
  }
}

// Delete an image
export async function DELETE({ params, url, locals }) {
  try {
    await requireLotAccess(locals, params.id);
    const imageId = url.searchParams.get('imageId');
    if (!imageId) {
      throw error(400, 'imageId parameter is required');
    }

    const image = await prisma.lotImage.findUnique({
      where: { id: imageId }
    });

    if (!image || image.lotId !== params.id) {
      throw error(404, 'Image not found');
    }

    // Delete from cloud storage
    if (image.cloudKey) {
      try {
        await deleteFile(image.cloudKey, 'lots');
      } catch (deleteError) {
        console.warn('Failed to delete from cloud storage:', deleteError);
        // Continue with database deletion even if cloud deletion fails
      }
    }

    // Delete from database
    await prisma.lotImage.delete({
      where: { id: imageId }
    });

    return json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error('Error deleting image:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to delete image');
  }
}

