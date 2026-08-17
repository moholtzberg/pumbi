import { json, error } from '@sveltejs/kit';
import { uploadFile } from '$lib/services/cloudStorage.js';
import prisma from '$lib/prisma.js';
import { env } from '$env/dynamic/private';
import {
  requireAuthenticatedUser,
  requireAuctionAccess
} from '$lib/server/authorization.js';

export async function POST({ request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const formData = await request.formData();
    const file = formData.get('file');
    const lotId = formData.get('lotId');
    const imageId = formData.get('imageId');

    if (!file || !lotId) {
      throw error(400, 'File and lotId are required');
    }

    // Verify lot exists and user has permission
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: { auction: true }
    });

    if (!lot) {
      throw error(404, 'Lot not found');
    }

    requireAuctionAccess(user, lot.auction);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to cloud storage
    const filename = file.name || `edited-${Date.now()}.jpg`;
    const { url, key } = await uploadFile(buffer, filename, 'images');

    let updatedImage;

    if (imageId) {
      // Update existing image
      const existingImage = await prisma.lotImage.findUnique({
        where: { id: imageId }
      });

      if (!existingImage || existingImage.lotId !== lotId) {
        throw error(404, 'Image not found');
      }

      // Delete old image from storage
      try {
        const { deleteFile } = await import('$lib/services/cloudStorage.js');
        if (existingImage.cloudKey) {
          await deleteFile(existingImage.cloudKey, 'lots');
        }
      } catch (err) {
        console.error('Error deleting old image:', err);
        // Continue even if deletion fails
      }

      // Update image record
      updatedImage = await prisma.lotImage.update({
        where: { id: imageId },
        data: {
          url,
          cloudKey: key
        }
      });
    } else {
      // Create new image record
      const maxOrder = await prisma.lotImage.findFirst({
        where: { lotId },
        orderBy: { displayOrder: 'desc' }
      });

      updatedImage = await prisma.lotImage.create({
        data: {
          lotId,
          url,
          cloudKey: key,
          displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
          isPrimary: false
        }
      });
    }

    return json({
      id: updatedImage.id,
      url: updatedImage.url,
      cloudKey: updatedImage.cloudKey,
      lotId: updatedImage.lotId
    });
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error saving edited image:', err);
    throw error(500, err.message || 'Failed to save edited image');
  }
}

