import { requireAuthenticatedUser } from '$lib/server/authorization.js';
import { error, fail } from '@sveltejs/kit';
import { houseBidderProfile, requireBidderHouse, setHouseBidderBlock } from '$lib/server/sellerBidders.js';
async function houseContext({ parent, locals, url }) {
  let id = url.searchParams.get('houseId');
  if (!id && parent) id = (await parent()).auctionHouse?.id;
  if (!id) {
    const actor = await requireAuthenticatedUser(locals);
    id = actor.auctionHouseId || actor.auctionHouseMemberships?.find(row => row.status === 'ACTIVE' && row.role === 'OWNER')?.auctionHouseId;
  }
  if (!id) throw error(400, 'Choose an auction house first');
  return requireBidderHouse(locals, id, { owner: true });
}
export async function load(event) {
  const { house } = await houseContext(event);
  const profile = await houseBidderProfile(house.id, event.params.id, Object.fromEntries(event.url.searchParams));
  event.setHeaders({ 'cache-control': 'private, no-store' });
  return { profile, bidderHouse: house };
}
export const actions = {
  block: async event => {
    const { house } = await houseContext(event);
    const form = await event.request.formData();
    try { await setHouseBidderBlock(event.locals, house.id, event.params.id, { blocked: true, reason: form.get('reason') }); }
    catch (err) { if (err.status === 400) return fail(400, { error: err.body?.message || 'Enter a block reason' }); throw err; }
    return { message: 'Bidder blocked from all auctions at this house.' };
  },
  unblock: async event => {
    const { house } = await houseContext(event);
    await setHouseBidderBlock(event.locals, house.id, event.params.id, { blocked: false });
    return { message: 'Bidder unblocked. Auction registration rules still apply.' };
  }
};
