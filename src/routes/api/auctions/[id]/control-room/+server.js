import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission, HOUSE_PERMISSIONS } from '$lib/server/authorization.js';
import { isAutoAdvanceEnabled, getOnBlockLotId } from '$lib/server/liveAuctionFloor.js';

async function authorize(locals, auctionId) {
  const user = await requireAuthenticatedUser(locals, 'Authentication required');
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { auctionHouse: true, auctioneer: { select: { id: true, name: true, email: true } } }
  });
  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);
  return { auction, user };
}

export async function GET({ params, locals }) {
  const { auction, user } = await authorize(locals, params.id);
  const [lots, bids, registrations] = await Promise.all([
    prisma.lot.findMany({
      where: { auctionId: auction.id },
      orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }],
      select: {
        id: true, lotNumber: true, title: true, status: true, isReady: true,
        currentBid: true, startingBid: true, bidIncrement: true, highestBidderId: true,
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
  const now = Date.now();
  const onBlockLotId = getOnBlockLotId(auction);
  const trackedOnBlock =
    (onBlockLotId && lots.find((lot) => lot.id === onBlockLotId && lot.status === 'ACTIVE')) || null;
  const timedOpen =
    lots.find((lot) => lot.status === 'ACTIVE' && lot.isReady && lot.endTime && lot.endTime.getTime() > now) ||
    null;
  const openLot = timedOpen || trackedOnBlock || null;
  const nextLot = lots.find((lot) =>
    lot.status === 'ACTIVE' &&
    lot.isReady &&
    lot.id !== openLot?.id &&
    (!lot.endTime || lot.endTime.getTime() <= now)
  ) || null;
  const remainingReadyLots = lots.filter((lot) => lot.status === 'ACTIVE' && lot.isReady).length;
  const finishedLots = lots.filter((lot) => ['SOLD', 'UNSOLD', 'WITHDRAWN'].includes(lot.status)).length;
  const allLotsComplete = remainingReadyLots === 0 && lots.some((lot) => lot.isReady);
  const canEndAuction = ['UPCOMING', 'LIVE'].includes(auction.status) && !openLot;

  return json({
    currentUserId: user.id,
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
    openLotId: openLot?.id || null,
    onBlockLotId: trackedOnBlock?.id || openLot?.id || null,
    nextLotId: nextLot?.id || null,
    remainingReadyLots,
    finishedLots,
    allLotsComplete,
    canEndAuction,
    autoAdvanceNextLot: isAutoAdvanceEnabled(auction),
    settingsPath: `/seller/auctions/${auction.id}/settings`,
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
