import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  requireAuctionAccess,
  requireAuctionHousePermission,
  HOUSE_PERMISSIONS
} from '$lib/server/authorization.js';

export async function load({ params, parent }) {
  const { session } = await parent();
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { auctionHouseMemberships: true }
  });
  if (!user) throw error(401, 'Authentication required');

  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
      auctionHouseId: true,
      sellerId: true
    }
  });
  if (!auction) throw error(404, 'Auction not found');

  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);

  return {
    auctionNav: {
      id: auction.id,
      title: auction.title,
      status: auction.status,
      type: auction.type
    }
  };
}
