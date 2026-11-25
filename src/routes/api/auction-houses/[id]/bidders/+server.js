import { json } from '@sveltejs/kit';
import { listHouseBidders, requireBidderHouse } from '$lib/server/sellerBidders.js';
export async function GET({ params, locals, url }) {
  const access = await requireBidderHouse(locals, params.id);
  const directory = await listHouseBidders(params.id, { q: url.searchParams.get('q'), page: url.searchParams.get('page'), auctionId: url.searchParams.get('auctionId'), blockedOnly: url.searchParams.get('blocked') === '1' });
  return json({ ...directory, house: access.house, canViewProfiles: access.canViewProfiles }, { headers: { 'cache-control': 'private, no-store' } });
}
