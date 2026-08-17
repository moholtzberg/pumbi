import prisma from '$lib/prisma.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';

const visibleAuctionStatuses = ['UPCOMING', 'LIVE'];

const lotSelect = {
  id: true,
  title: true,
  currentBid: true,
  startingBid: true,
  watchersCount: true,
  endTime: true,
  auction: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      auctionHouse: { select: { name: true } }
    }
  },
  images: {
    where: { isHidden: false },
    orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
    take: 1,
    select: { url: true }
  },
  _count: { select: { bids: true } }
};

async function presentLot(lot) {
  return {
    id: lot.id,
    title: lot.title,
    currentBid: lot.currentBid,
    startingBid: lot.startingBid,
    watchersCount: lot.watchersCount,
    bidCount: lot._count.bids,
    activityCount: lot.watchersCount + lot._count.bids,
    endTime: lot.endTime,
    auction: lot.auction,
    imageUrl: await convertToPresignedUrl(lot.images[0]?.url ?? null)
  };
}

export async function load() {
  const lotVisibility = {
    isReady: true,
    status: 'ACTIVE',
    auction: { status: { in: visibleAuctionStatuses } }
  };

  const [watchedLots, activityCandidates, auctionCandidates] = await prisma.$transaction([
    prisma.lot.findMany({
      where: lotVisibility,
      orderBy: [{ watchersCount: 'desc' }, { updatedAt: 'desc' }],
      take: 6,
      select: lotSelect
    }),
    prisma.lot.findMany({
      where: lotVisibility,
      orderBy: [{ watchersCount: 'desc' }, { updatedAt: 'desc' }],
      take: 48,
      select: lotSelect
    }),
    prisma.auction.findMany({
      where: { status: { in: visibleAuctionStatuses } },
      orderBy: { startDate: 'asc' },
      take: 30,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        status: true,
        type: true,
        startDate: true,
        endDate: true,
        auctionHouse: { select: { name: true } },
        _count: { select: { registrations: true, lots: true } }
      }
    })
  ]);

  const activeLots = activityCandidates
    .sort((a, b) => (b.watchersCount + b._count.bids) - (a.watchersCount + a._count.bids))
    .slice(0, 6);
  const popularAuctions = auctionCandidates
    .sort((a, b) => b._count.registrations - a._count.registrations || a.startDate - b.startDate)
    .slice(0, 6);

  return {
    mostWatchedLots: await Promise.all(watchedLots.map(presentLot)),
    mostActiveLots: await Promise.all(activeLots.map(presentLot)),
    popularAuctions: await Promise.all(popularAuctions.map(async (auction) => ({
      ...auction,
      imageUrl: await convertToPresignedUrl(auction.imageUrl),
      subscriberCount: auction._count.registrations,
      lotCount: auction._count.lots
    })))
  };
}
