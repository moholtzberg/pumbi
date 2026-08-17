import prisma from '$lib/prisma.js';

export async function load() {
  const [auctions, liveAuctions, auctionHouses, pendingHouses, users, lots, pendingLots, pendingPayouts, recentAuctions] = await prisma.$transaction([
    prisma.auction.count(),
    prisma.auction.count({ where: { status: 'LIVE' } }),
    prisma.auctionHouse.count(),
    prisma.auctionHouse.count({ where: { onboardingStatus: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.user.count(),
    prisma.lot.count(),
    prisma.lotSubmission.count({ where: { status: 'SUBMITTED' } }),
    prisma.payoutRelease.count({ where: { status: { in: ['REQUESTED', 'PROCESSING'] } } }),
    prisma.auction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, type: true, status: true, startDate: true,
        auctionHouse: { select: { name: true } },
        _count: { select: { lots: true, registrations: true } }
      }
    })
  ]);

  return {
    metrics: { auctions, liveAuctions, auctionHouses, pendingHouses, users, lots, pendingLots, pendingPayouts },
    recentAuctions
  };
}
