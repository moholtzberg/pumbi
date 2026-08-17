import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';
import {
  requireAuthenticatedUser,
  requireAuctionAccess
} from '$lib/server/authorization.js';

export async function GET({ params, locals }) {
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

    const notes = await prisma.lotNote.findMany({
      where: { lotId: params.id },
      orderBy: { createdAt: 'desc' }
    });

    // Convert audio URLs to presigned URLs if they're S3 keys
    const notesWithPresignedUrls = await Promise.all(
      notes.map(async (note) => {
        if (note.audioUrl) {
          const presignedUrl = await convertToPresignedUrl(note.audioUrl);
          return {
            ...note,
            audioUrl: presignedUrl
          };
        }
        return note;
      })
    );

    return json(notesWithPresignedUrls);
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error fetching notes:', err);
    throw error(500, 'Failed to fetch notes');
  }
}

