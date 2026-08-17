import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

export async function POST({ request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const { auctionId, lotIds } = await request.json();

    if (!auctionId || !Array.isArray(lotIds)) {
      throw error(400, 'Invalid request: auctionId and lotIds array are required');
    }

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId }
    });
    requireAuctionAccess(user, auction);
    await requireAuctionHousePermission(
      user,
      auction.auctionHouseId,
      HOUSE_PERMISSIONS.MANAGE_CATALOG
    );

    const matchingLots = await prisma.lot.count({
      where: { id: { in: lotIds }, auctionId }
    });
    if (matchingLots !== lotIds.length) {
      throw error(400, 'All lots must belong to the specified auction');
    }

    // Update positions for all lots
    const updates = lotIds.map((lotId, index) => {
      return prisma.lot.update({
        where: { id: lotId },
        data: { position: index + 1 }
      });
    });

    await Promise.all(updates);

    return json({ success: true, message: 'Lots reordered successfully' });
  } catch (err) {
    console.error('Error reordering lots:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, 'Failed to reorder lots');
  }
}

