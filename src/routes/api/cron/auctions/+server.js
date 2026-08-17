import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { processAuctionAutomation } from '$lib/server/auctionAutomation.js';

function secureStringEqual(left, right) {
	const leftDigest = createHash('sha256').update(left).digest();
	const rightDigest = createHash('sha256').update(right).digest();
	return timingSafeEqual(leftDigest, rightDigest);
}

function isAuthorized(request, secret) {
	const authorization = request.headers.get('authorization') ?? '';
	return secureStringEqual(authorization, `Bearer ${secret}`);
}

export async function POST({ request }) {
	const cronSecret = env.CRON_SECRET;
	if (!cronSecret) {
		console.error('CRON_SECRET is not configured');
		return json(
			{ error: 'Auction automation is not configured' },
			{ status: 503, headers: { 'cache-control': 'no-store' } }
		);
	}

	if (!isAuthorized(request, cronSecret)) {
		return json(
			{ error: 'Unauthorized' },
			{ status: 401, headers: { 'cache-control': 'no-store' } }
		);
	}

	try {
		const result = await processAuctionAutomation();
		return json(result, {
			status: result.errors.length > 0 ? 500 : 200,
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		console.error('Auction automation cron failed:', error);
		return json(
			{ error: 'Auction automation failed' },
			{ status: 500, headers: { 'cache-control': 'no-store' } }
		);
	}
}
