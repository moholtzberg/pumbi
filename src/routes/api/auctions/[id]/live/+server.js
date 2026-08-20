import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { db } from '$lib/db.js';
import { resolveLotTiming } from '$lib/server/lotTiming.js';

export async function GET({ params }) {
  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    include: { auctionHouse: true }
  });
  if (!auction) throw error(404, 'Auction not found');

  const lots = await prisma.lot.findMany({
    where: { auctionId: auction.id, status: 'ACTIVE', isReady: true },
    select: { id: true, position: true, lotNumber: true, endTime: true },
    orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }]
  });
  const now = Date.now();
  const timedLots = lots
    .filter((lot) => lot.endTime && lot.endTime.getTime() > now)
    .sort((a, b) => a.endTime.getTime() - b.endTime.getTime() || a.position - b.position);
  const selected = timedLots[0] || lots.find((lot) => !lot.endTime) || null;

  const [currentLot, recentBids] = await Promise.all([
    selected ? db.lots.getById(selected.id) : null,
    prisma.bid.findMany({
      where: { lot: { auctionId: auction.id } },
      include: { lot: { select: { lotNumber: true, title: true } } },
      orderBy: { timestamp: 'desc' },
      take: 20
    })
  ]);

  return json({
    currentLot,
    timing: currentLot
      ? resolveLotTiming({ lot: currentLot, auction, auctionHouse: auction.auctionHouse })
      : null,
    recentBids: recentBids.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      bidderName: bid.userName,
      timestamp: bid.timestamp,
      lotNumber: bid.lot.lotNumber,
      lotTitle: bid.lot.title,
      isCurrentLot: bid.lotId === selected?.id
    }))
  }, { headers: { 'cache-control': 'no-store' } });
}
