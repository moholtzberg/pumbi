import { error } from '@sveltejs/kit';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';
import prisma from '$lib/prisma.js';
import { getAuctionInterest } from '$lib/server/analytics.js';

export async function load({ locals, params }) {
  const user = await requireAuthenticatedUser(locals);
  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, auctionHouseId: true, sellerId: true, type: true }
  });
  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);

  const interest = await getAuctionInterest(auction.id);
  if (!interest) throw error(404, 'Auction not found');
  return interest;
}
