import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';

const STATUSES = new Set(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']);

export async function GET({ url, locals }) {
  await requirePlatformAdmin(locals);
  const status = url.searchParams.get('status');
  if (status && !STATUSES.has(status)) throw error(400, 'Invalid onboarding status');
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || '25', 10) || 25)
  );
  const where = status ? { onboardingStatus: status } : {};

  const [auctionHouses, total] = await prisma.$transaction([
    prisma.auctionHouse.findMany({
      where,
      select: {
        id: true,
        name: true,
        legalName: true,
        country: true,
        onboardingStatus: true,
        onboardingSubmittedAt: true,
        onboardingReviewedAt: true,
        onboardingApprovedAt: true,
        onboardingRejectedAt: true,
        onboardingRejectionReason: true,
        isActive: true,
        _count: { select: { locations: true, documents: true, assets: true } }
      },
      orderBy: [{ onboardingSubmittedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.auctionHouse.count({ where })
  ]);

  return json({ auctionHouses, pagination: { page, pageSize, total } });
}
