import { error } from '@sveltejs/kit';
import { requireMarketingHouse } from '$lib/server/marketing.js';
export async function load({ parent, locals }) {
  const data = await parent();
  const houseId = data.auctionHouse?.id || data.session?.user?.auctionHouseId;
  if (!houseId) throw error(400, 'Choose an auction house before opening Marketing');
  return { marketingHouse: await requireMarketingHouse(locals, houseId) };
}
