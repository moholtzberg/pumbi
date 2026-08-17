import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';

export async function GET({ url, locals }) {
  await requirePlatformAdmin(locals);
  const status = url.searchParams.get('status');
  const allowed = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
  if (status && !allowed.includes(status)) throw error(400, 'Invalid submission status');

  const [rawSubmissions, publicAuctions] = await Promise.all([
    prisma.lotSubmission.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ status: 'asc' }, { submittedAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        sellerProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
        auctionSeries: { select: { id: true, name: true, auctionType: true } },
        auction: { select: { id: true, title: true, type: true, startDate: true } },
        approvedLot: { select: { id: true, lotNumber: true, auctionId: true } },
        reviewedBy: { select: { name: true, email: true } },
        images: { orderBy: { displayOrder: 'asc' } }
      }
    }),
    prisma.auction.findMany({
      where: { type: 'PUBLIC', status: { in: ['UPCOMING', 'LIVE'] } },
      orderBy: { startDate: 'asc' },
      select: { id: true, title: true, seriesId: true, startDate: true }
    })
  ]);

  const submissions = await Promise.all(rawSubmissions.map(async (submission) => ({
    ...submission,
    images: await Promise.all(submission.images.map(async (image) => ({
      ...image,
      previewUrl: await convertToPresignedUrl(image.url)
    })))
  })));

  return json({ submissions, publicAuctions });
}
