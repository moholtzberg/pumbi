import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';

export async function GET({ url, locals }) {
  await requirePlatformAdmin(locals);
  const status = url.searchParams.get('status');
  const allowed = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
  if (status && !allowed.includes(status)) throw error(400, 'Invalid submission status');

  const [submissions, publicAuctions] = await Promise.all([
    prisma.lotSubmission.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ status: 'asc' }, { submittedAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        sellerProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
        auctionSeries: { select: { id: true, name: true, auctionType: true } },
        auction: { select: { id: true, title: true, type: true, startDate: true } },
        approvedLot: { select: { id: true, lotNumber: true, auctionId: true } },
        reviewedBy: { select: { name: true, email: true } }
      }
    }),
    prisma.auction.findMany({
      where: { type: 'PUBLIC', status: { in: ['UPCOMING', 'LIVE'] } },
      orderBy: { startDate: 'asc' },
      select: { id: true, title: true, seriesId: true, startDate: true }
    })
  ]);

  return json({ submissions, publicAuctions });
}
