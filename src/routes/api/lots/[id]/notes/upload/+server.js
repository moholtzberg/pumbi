import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { uploadFile } from '$lib/services/cloudStorage.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

export async function POST({ params, request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const lot = await prisma.lot.findUnique({
      where: { id: params.id },
      include: { auction: { include: { auctionHouse: true } } }
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

    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      throw error(400, 'No audio file provided');
    }

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3 (or configured cloud storage)
    const { url, key } = await uploadFile(buffer, audioFile.name, 'voice-notes');

    // Create note record with S3 key/URL
    const note = await prisma.lotNote.create({
      data: {
        lotId: params.id,
        audioUrl: url // This will be the S3 key, converted to presigned URL when needed
      }
    });

    return json({ noteId: note.id, note });
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error uploading audio:', err);
    throw error(500, err.message || 'Failed to upload audio');
  }
}

