import prisma from '$lib/prisma.js';

export async function load({ url }) {
  const search = url.searchParams.get('q')?.trim() || '';
  const role = url.searchParams.get('role') || '';
  const where = {
    ...(role ? { role } : {}),
    ...(search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, name: true, role: true, isVerifiedBuyer: true, isVerifiedBidder: true, createdAt: true,
        emailVerifiedAt: true, phoneVerifiedAt: true,
        identityVerificationStatus: true, cardVerificationStatus: true,
        auctionHouse: { select: { name: true } },
        _count: { select: { bids: true, auctionHouseMemberships: true } }
      }
    }),
    prisma.user.count({ where })
  ]);

  return { users, total, filters: { search, role } };
}
