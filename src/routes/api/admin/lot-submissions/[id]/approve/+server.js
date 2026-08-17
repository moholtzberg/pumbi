import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { adminError, requirePlatformAdmin } from '$lib/server/platformAdmin.js';

async function resolveAuction(tx, submission, requestedAuctionId) {
  const auctionId = requestedAuctionId || submission.auctionId;
  if (auctionId) {
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      include: { series: { select: { submissionCutoffOffsetDays: true } } }
    });
    if (!auction) throw error(404, 'Selected auction not found');
    if (auction.type !== 'PUBLIC') throw error(400, 'Submissions may only be approved into a public auction');
    if (auction.status !== 'UPCOMING' || auction.startDate <= new Date()) {
      throw error(400, 'Submissions may only be approved into an upcoming auction');
    }
    const cutoffDays = auction.series?.submissionCutoffOffsetDays ?? 0;
    const cutoff = new Date(auction.startDate.getTime() - cutoffDays * 86_400_000);
    if (new Date() >= cutoff) throw error(409, 'The submission cutoff has passed');
    return auction;
  }

  if (!submission.auctionSeriesId) {
    throw error(400, 'Select a public auction or assign the submission to a public series');
  }

  const series = await tx.auctionSeries.findUnique({ where: { id: submission.auctionSeriesId } });
  if (!series || !series.isActive || series.auctionType !== 'PUBLIC') {
    throw error(400, 'Submission series must be an active public series');
  }

  const existing = await tx.auction.findFirst({
    where: {
      seriesId: series.id,
      type: 'PUBLIC',
      status: 'UPCOMING',
      startDate: { gt: new Date() }
    },
    orderBy: { startDate: 'asc' },
    include: { series: { select: { submissionCutoffOffsetDays: true } } }
  });
  if (existing) {
    const cutoff = new Date(existing.startDate.getTime() - series.submissionCutoffOffsetDays * 86_400_000);
    if (new Date() < cutoff) return existing;
  }

  throw error(409, 'No generated series auction is currently accepting submissions. Run the secured automation or wait for the next submission window.');
}

async function approveOnce(submissionId, auctionId, adminId) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.lotSubmission.findUnique({
      where: { id: submissionId },
      include: { sellerProfile: { select: { id: true, userId: true } }, approvedLot: { select: { id: true } } }
    });
    if (!submission) throw error(404, 'Lot submission not found');
    if (submission.status !== 'SUBMITTED' || submission.approvedLot) {
      throw error(409, 'This submission is not awaiting approval');
    }
    if (!submission.title?.trim()) throw error(400, 'Submission needs a title before approval');

    const auction = await resolveAuction(tx, submission, auctionId);
    const maximum = await tx.lot.aggregate({
      where: { auctionId: auction.id },
      _max: { lotNumber: true, position: true }
    });
    const lotNumber = (maximum._max.lotNumber ?? 0) + 1;
    const startingBid = Number(submission.requestedStartingBid ?? 0);
    const lot = await tx.lot.create({
      data: {
        auctionId: auction.id,
        lotNumber,
        position: (maximum._max.position ?? 0) + 1,
        title: submission.title.trim(),
        description: submission.description,
        category: submission.category,
        tags: submission.tags,
        metaFields: submission.metaFields,
        startingBid,
        currentBid: startingBid,
        bidIncrement: Number(submission.requestedBidIncrement ?? 1),
        endTime: auction.endDate,
        isReady: true,
        ownerUserId: submission.sellerProfile.userId,
        submittingSellerProfileId: submission.sellerProfile.id,
        submissionId: submission.id
      }
    });

    const reviewed = await tx.lotSubmission.updateMany({
      where: { id: submission.id, status: 'SUBMITTED' },
      data: {
        status: 'APPROVED',
        auctionId: auction.id,
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: null
      }
    });
    if (reviewed.count !== 1) throw error(409, 'This submission was already reviewed');
    return { lot, auction };
  }, { isolationLevel: 'Serializable' });
}

export async function POST({ params, request, locals }) {
  const admin = await requirePlatformAdmin(locals);
  try {
    const data = await request.json().catch(() => ({}));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await approveOnce(params.id, data.auctionId || null, admin.id);
        return json(result, { status: 201 });
      } catch (err) {
        if (!['P2034', 'P2002'].includes(err?.code) || attempt === 2) throw err;
      }
    }
  } catch (err) {
    adminError(err, 'Failed to approve lot submission');
  }
}
