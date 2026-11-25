import { error } from '@sveltejs/kit';
import { listHouseBidders, requireBidderHouse } from '$lib/server/sellerBidders.js';
export async function load({ parent, locals, url, setHeaders }) {
  const data = await parent();
  const houseId = url.searchParams.get('houseId') || data.auctionHouse?.id;
  if (!houseId) throw error(400, 'Choose an auction house first');
  const access = await requireBidderHouse(locals, houseId);
  const directory = await listHouseBidders(houseId, { q: url.searchParams.get('q'), page: url.searchParams.get('page'), auctionId: url.searchParams.get('auctionId'), blockedOnly: url.searchParams.get('blocked') === '1' });
  setHeaders({ 'cache-control': 'private, no-store' });
  return { bidderHouse: access.house, directory, canViewBidderProfiles: access.canViewProfiles };
}
