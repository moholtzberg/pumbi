import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { deleteFile } from '$lib/services/cloudStorage.js';
import { extractS3Key } from '$lib/utils/s3Presigned.js';
import {
  requireAuthenticatedUser,
  requireAuctionAccess
} from '$lib/server/authorization.js';

export async function DELETE({ params, locals }) {
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

    const note = await prisma.lotNote.findUnique({
      where: { id: params.noteId }
    });

    if (!note || note.lotId !== params.id) {
      throw error(404, 'Note not found');
    }

    // Delete audio file from S3 or local storage if it exists
    if (note.audioUrl) {
      try {
        // Extract S3 key if it's an S3 URL, otherwise use the URL as-is
        const key = extractS3Key(note.audioUrl) || note.audioUrl;
        // Determine folder from key
        const folder = key.startsWith('voice-notes/') ? 'voice-notes' : 'voice-notes';
        await deleteFile(key, folder);
      } catch (err) {
        console.error('Error deleting audio file:', err);
        // Continue even if file deletion fails
      }
    }

    // Delete note
    await prisma.lotNote.delete({
      where: { id: params.noteId }
    });

    return json({ message: 'Note deleted successfully' });
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error deleting note:', err);
    throw error(500, 'Failed to delete note');
  }
}

