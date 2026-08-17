import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';

const STATUSES = [
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'REJECTED',
  'FAILED',
  'CANCELLED'
];

export async function GET({ locals, url }) {
  await requirePlatformAdmin(locals);
  const status = url.searchParams.get('status');
  if (status && !STATUSES.includes(status)) throw error(400, 'Invalid payout release status');

  const releases = await prisma.payoutRelease.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: 'desc' },
    include: {
      auctionHouse: {
        select: {
          id: true,
          name: true,
          onboardingStatus: true,
          stripeConnectStatus: true,
          stripeConnectPayoutsEnabled: true
        }
      },
      requestedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } }
    }
  });

  return json({ releases });
}
