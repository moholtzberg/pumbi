import prisma from '$lib/prisma.js';

export async function load({ url }) {
  const search = url.searchParams.get('q')?.trim() || '';
  const status = url.searchParams.get('status') || '';
  const where = {
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { auction: { title: { contains: search, mode: 'insensitive' } } }
      ]
    } : {})
  };

  const [lots, total] = await prisma.$transaction([
    prisma.lot.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, lotNumber: true, title: true, status: true, isReady: true, startingBid: true, currentBid: true, createdAt: true,
        auction: { select: { id: true, title: true, type: true, auctionHouse: { select: { name: true } } } },
        _count: { select: { images: true, bids: true } }
      }
    }),
    prisma.lot.count({ where })
  ]);

  return { lots, total, filters: { search, status } };
}
