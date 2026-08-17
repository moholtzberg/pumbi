import prisma from '$lib/prisma.js';

const statuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

export async function load({ url }) {
  const status = url.searchParams.get('status') || '';
  const search = url.searchParams.get('q')?.trim() || '';
  const where = {
    ...(statuses.includes(status) ? { onboardingStatus: status } : {}),
    ...(search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { legalName: { contains: search, mode: 'insensitive' } },
      { contactEmail: { contains: search, mode: 'insensitive' } }
    ] } : {})
  };

  const [auctionHouses, total] = await prisma.$transaction([
    prisma.auctionHouse.findMany({
      where,
      take: 100,
      orderBy: [{ onboardingSubmittedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, slug: true, legalName: true, country: true, contactEmail: true, isActive: true,
        onboardingStatus: true, onboardingSubmittedAt: true, stripeConnectStatus: true, createdAt: true,
        _count: { select: { auctions: true, memberships: true, locations: true, documents: true } }
      }
    }),
    prisma.auctionHouse.count({ where })
  ]);

  return { auctionHouses, total, filters: { status, search }, statuses };
}
