import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { getAuctionActivity } from '$lib/server/auctionActivity.js';

export async function GET({ params, url }) {
  const auction = await prisma.auction.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
  if (!auction) throw error(404, 'Auction not found');
  const lotId = url.searchParams.get('lotId') || null;
  const lot = lotId ? await prisma.lot.findFirst({
    where: { id: lotId, auctionId: auction.id },
    select: { id: true, lotNumber: true, title: true, startingBid: true }
  }) : null;
  if (lotId && !lot) throw error(404, 'Lot not found in this auction');
  const activity = await getAuctionActivity({ auctionId: auction.id, lotId });
  const finished = ['ENDED', 'CANCELLED'].includes(auction.status);
  return json({ ...activity, activeBidders: finished ? 0 : activity.activeBidders, lot, finished }, {
    // Aggregate statistics contain no visitor identities or bidder details.
    headers: { 'cache-control': 'public, max-age=0, s-maxage=3' }
  });
}
