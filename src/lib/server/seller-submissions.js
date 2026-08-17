import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';

export const submissionSelect = {
  id: true,
  status: true,
  title: true,
  description: true,
  category: true,
  requestedStartingBid: true,
  requestedBidIncrement: true,
  auctionSeriesId: true,
  auctionId: true,
  acceptedPolicyVersion: true,
  termsAcceptedAt: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  auctionSeries: { select: { id: true, name: true, nextRunAt: true } },
  auction: { select: { id: true, title: true, startDate: true } },
  approvedLot: { select: { id: true, auctionId: true, lotNumber: true } }
};

export async function requireCurrentUser(locals) {
  const session = await locals.auth?.();
  const email = session?.user?.email;

  if (!email) {
    throw error(401, 'You must be logged in');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true }
  });

  if (!user) {
    throw error(404, 'User account not found');
  }

  return user;
}

export async function getActivePolicy(now = new Date()) {
  return prisma.platformPolicy.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
    },
    orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    select: {
      id: true,
      version: true,
      sellerTerms: true,
      sellerCommissionRate: true,
      rateConfig: true,
      effectiveFrom: true,
      effectiveTo: true
    }
  });
}

export async function getPublicOpportunities(now = new Date()) {
  const [allSeries, allAuctions] = await Promise.all([
    prisma.auctionSeries.findMany({
      where: { isActive: true, auctionType: 'PUBLIC' },
      orderBy: [{ nextRunAt: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        timezone: true,
        recurrenceDayOfMonth: true,
        recurrenceLocalTime: true,
        nextRunAt: true,
        submissionCutoffOffsetDays: true,
        auctionStartOffsetMinutes: true
      }
    }),
    prisma.auction.findMany({
      where: {
        type: 'PUBLIC',
        status: 'UPCOMING',
        startDate: { gt: now }
      },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        seriesId: true,
        series: { select: { submissionCutoffOffsetDays: true } }
      }
    })
  ]);

  const series = allSeries.filter((item) => {
    if (!item.nextRunAt) return false;
    const startsAt = new Date(item.nextRunAt.getTime() + item.auctionStartOffsetMinutes * 60_000);
    const cutoff = new Date(startsAt.getTime() - item.submissionCutoffOffsetDays * 86_400_000);
    return now < cutoff;
  });
  const auctions = allAuctions.filter((item) => {
    const cutoffDays = item.series?.submissionCutoffOffsetDays ?? 0;
    return now < new Date(item.startDate.getTime() - cutoffDays * 86_400_000);
  }).map(({ series: _series, ...item }) => item);

  return { series, auctions };
}

export function readSubmissionInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object');
  }

  const text = (value, maxLength) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw error(400, 'Text fields must be strings');
    const trimmed = value.trim();
    if (trimmed.length > maxLength) throw error(400, `A field exceeds ${maxLength} characters`);
    return trimmed || null;
  };

  const money = (value, label) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 9999999999.99) {
      throw error(400, `${label} must be between 0 and 9,999,999,999.99`);
    }
    return number.toFixed(2);
  };

  const data = {
    title: text(body.title, 200),
    description: text(body.description, 10000),
    category: text(body.category, 100),
    requestedStartingBid: money(body.requestedStartingBid, 'Requested starting bid'),
    requestedBidIncrement: money(body.requestedBidIncrement, 'Requested bid increment')
  };

  if (body.auctionSeriesId !== undefined || body.auctionId !== undefined) {
    const auctionSeriesId = text(body.auctionSeriesId, 100);
    const auctionId = text(body.auctionId, 100);
    if (!!auctionSeriesId === !!auctionId) {
      throw error(400, 'Choose exactly one public auction series or upcoming public auction');
    }
    data.auctionSeriesId = auctionSeriesId;
    data.auctionId = auctionId;
  }

  return data;
}

export async function validatePublicTarget({ auctionSeriesId, auctionId }, now = new Date()) {
  if (!!auctionSeriesId === !!auctionId) {
    throw error(400, 'Choose exactly one public auction series or upcoming public auction');
  }

  if (auctionSeriesId) {
    const series = await prisma.auctionSeries.findFirst({
      where: { id: auctionSeriesId, isActive: true, auctionType: 'PUBLIC' },
      select: {
        id: true,
        nextRunAt: true,
        auctionStartOffsetMinutes: true,
        submissionCutoffOffsetDays: true
      }
    });
    if (!series) throw error(400, 'The selected public auction series is no longer available');
    if (!series.nextRunAt) throw error(400, 'The selected series is not scheduled yet');
    const startsAt = new Date(series.nextRunAt.getTime() + series.auctionStartOffsetMinutes * 60_000);
    const cutoff = new Date(startsAt.getTime() - series.submissionCutoffOffsetDays * 86_400_000);
    if (now >= cutoff) throw error(409, 'The submission cutoff has passed for the next auction');
    return;
  }

  const auction = await prisma.auction.findFirst({
    where: {
      id: auctionId,
      type: 'PUBLIC',
      status: 'UPCOMING',
      startDate: { gt: now }
    },
    select: {
      id: true,
      startDate: true,
      series: { select: { submissionCutoffOffsetDays: true } }
    }
  });
  if (!auction) throw error(400, 'The selected public auction is no longer available');
  const cutoffDays = auction.series?.submissionCutoffOffsetDays ?? 0;
  const cutoff = new Date(auction.startDate.getTime() - cutoffDays * 86_400_000);
  if (now >= cutoff) throw error(409, 'The submission cutoff has passed for this auction');
}

export function serializeSubmission(submission) {
  return {
    ...submission,
    requestedStartingBid: submission.requestedStartingBid?.toString() ?? null,
    requestedBidIncrement: submission.requestedBidIncrement?.toString() ?? null
  };
}
