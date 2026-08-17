import prisma from '$lib/prisma.js';
import { getNextMonthlyRunAt } from './auctionSchedule.js';

function addMinutes(date, minutes) {
	return new Date(date.getTime() + minutes * 60_000);
}

async function processSeriesOccurrence(client, seriesId, expectedOccurrenceAt, now) {
	return client.$transaction(async (tx) => {
		const series = await tx.auctionSeries.findUnique({ where: { id: seriesId } });

		if (
			!series ||
			!series.isActive ||
			series.auctionType !== 'PUBLIC' ||
			!series.nextRunAt ||
			series.nextRunAt.getTime() !== expectedOccurrenceAt.getTime() ||
			series.nextRunAt > now
		) {
			return { skipped: true, seriesId };
		}

		const policy = await tx.platformPolicy.findFirst({
			where: {
				isActive: true,
				effectiveFrom: { lte: now },
				OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
			},
			orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
		});

		if (!policy) {
			throw new Error('No active platform policy is effective for this occurrence');
		}

		const occurrenceAt = series.nextRunAt;
		const nextRunAt = getNextMonthlyRunAt({
			after: occurrenceAt,
			timezone: series.timezone,
			dayOfMonth: series.recurrenceDayOfMonth,
			localTime: series.recurrenceLocalTime
		});

		// Claim this exact occurrence. A concurrent worker that already advanced
		// nextRunAt gets count 0 and cannot create or assign anything.
		const claim = await tx.auctionSeries.updateMany({
			where: {
				id: series.id,
				isActive: true,
				auctionType: 'PUBLIC',
				nextRunAt: occurrenceAt
			},
			data: { nextRunAt }
		});

		if (claim.count === 0) {
			return { skipped: true, seriesId };
		}

		const startDate = addMinutes(occurrenceAt, series.auctionStartOffsetMinutes);
		const endDate = addMinutes(startDate, series.auctionDurationMinutes);
		const status = endDate <= now ? 'ENDED' : startDate <= now ? 'LIVE' : 'UPCOMING';

		const auction = await tx.auction.upsert({
			where: {
				seriesId_seriesOccurrenceAt: {
					seriesId: series.id,
					seriesOccurrenceAt: occurrenceAt
				}
			},
			update: {},
			create: {
				title: `${series.name} — ${startDate.toLocaleDateString('en-US', {
					timeZone: series.timezone,
					month: 'long',
					year: 'numeric'
				})}`,
				startDate,
				endDate,
				status,
				type: 'PUBLIC',
				auctionHouseId: series.auctionHouseId,
				sellerId: series.createdById,
				seriesId: series.id,
				seriesOccurrenceAt: occurrenceAt,
				platformPolicyId: policy.id,
				policyVersionSnapshot: policy.version,
				buyerTermsSnapshot: policy.buyerTerms,
				sellerTermsSnapshot: policy.sellerTerms,
				buyerPremiumRateSnapshot: policy.buyerPremiumRate,
				sellerCommissionRateSnapshot: policy.sellerCommissionRate,
				...(policy.rateConfig === null ? {} : { rateConfigSnapshot: policy.rateConfig })
			}
		});

		const assignedSubmissions = await tx.lotSubmission.updateMany({
			where: {
				auctionSeriesId: series.id,
				auctionId: null,
				status: 'APPROVED'
			},
			data: { auctionId: auction.id }
		});

		return {
			skipped: false,
			seriesId: series.id,
			auctionId: auction.id,
			occurrenceAt,
			nextRunAt,
			assignedSubmissions: assignedSubmissions.count
		};
	});
}

async function transitionAuctionStatuses(client, now) {
	return client.$transaction(async (tx) => {
		const ended = await tx.auction.updateMany({
			where: {
				status: { in: ['UPCOMING', 'LIVE'] },
				endDate: { lte: now }
			},
			data: { status: 'ENDED' }
		});

		const live = await tx.auction.updateMany({
			where: {
				status: 'UPCOMING',
				startDate: { lte: now },
				endDate: { gt: now }
			},
			data: { status: 'LIVE' }
		});

		return { live: live.count, ended: ended.count };
	});
}

/**
 * Generates one occurrence for every currently-due active PUBLIC series and
 * advances each successfully claimed series by one configured calendar month.
 * Passing a client is supported for focused integration tests.
 */
export async function processAuctionAutomation({
	now = new Date(),
	client = prisma
} = {}) {
	const runAt = now instanceof Date ? now : new Date(now);
	if (Number.isNaN(runAt.getTime())) {
		throw new Error('A valid automation timestamp is required');
	}

	const dueSeries = await client.auctionSeries.findMany({
		where: {
			isActive: true,
			auctionType: 'PUBLIC',
			nextRunAt: { lte: runAt }
		},
		select: { id: true, nextRunAt: true },
		orderBy: [{ nextRunAt: 'asc' }, { id: 'asc' }]
	});

	const occurrences = [];
	const errors = [];

	for (const series of dueSeries) {
		let expectedOccurrenceAt = series.nextRunAt;
		for (let catchUpCount = 0; expectedOccurrenceAt <= runAt && catchUpCount < 24; catchUpCount += 1) {
			try {
				const result = await processSeriesOccurrence(
					client,
					series.id,
					expectedOccurrenceAt,
					runAt
				);
				if (result.skipped) break;
				occurrences.push(result);
				expectedOccurrenceAt = result.nextRunAt;
			} catch (error) {
				console.error(`Auction automation failed for series ${series.id}:`, error);
				errors.push({
					seriesId: series.id,
					message: error instanceof Error ? error.message : 'Unknown automation error'
				});
				break;
			}
		}
	}

	const transitions = await transitionAuctionStatuses(client, runAt);

	return {
		runAt,
		dueSeries: dueSeries.length,
		createdOrRecoveredOccurrences: occurrences.length,
		occurrences,
		transitions,
		errors
	};
}
