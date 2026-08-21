import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission, HOUSE_PERMISSIONS } from '$lib/server/authorization.js';

async function authorize(locals, auctionId) {
  const user = await requireAuthenticatedUser(locals, 'Authentication required');
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { auctionHouse: true, auctioneer: { select: { id: true, name: true, email: true } } }
  });
  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.VIEW);
  return auction;
}

export async function GET({ params, locals }) {
  const auction = await authorize(locals, params.id);
  const [lots, bids, registrations] = await Promise.all([
    prisma.lot.findMany({
      where: { auctionId: auction.id },
      orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }],
      select: {
        id: true, lotNumber: true, title: true, status: true, isReady: true,
        currentBid: true, bidIncrement: true, highestBidderId: true,
        highestBidderName: true, endTime: true, position: true
      }
    }),
    prisma.bid.findMany({
      where: { lot: { auctionId: auction.id } },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { lot: { select: { lotNumber: true, title: true } } }
    }),
    prisma.auctionRegistration.groupBy({
      by: ['status'],
      where: { auctionId: auction.id },
      _count: { _all: true }
    })
  ]);

  const counts = Object.fromEntries(registrations.map((entry) => [entry.status, entry._count._all]));
  return json({
    auction: {
      id: auction.id,
      title: auction.title,
      status: auction.status,
      startDate: auction.startDate,
      endDate: auction.endDate,
      auctioneerId: auction.auctioneerId,
      auctioneerStartedAt: auction.auctioneerStartedAt,
      auctioneer: auction.auctioneer,
      liveSettings: (() => {
        try {
          const settings = auction.settings ? JSON.parse(auction.settings) : {};
          return {
            liveVideoUrl: settings.liveVideoUrl || null,
            liveVideoTitle: settings.liveVideoTitle || null,
            liveAudioUrl: settings.liveAudioUrl || null,
            liveAudioTitle: settings.liveAudioTitle || null
          };
        } catch {
          return {};
        }
      })()
    },
    lots,
    bids: bids.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      bidderName: bid.userName,
      timestamp: bid.timestamp,
      lotNumber: bid.lot.lotNumber,
      lotTitle: bid.lot.title
    })),
    registrations: counts
  }, { headers: { 'cache-control': 'no-store' } });
}
