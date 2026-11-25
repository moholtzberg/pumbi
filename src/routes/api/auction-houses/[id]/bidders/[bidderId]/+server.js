import { json, error } from '@sveltejs/kit';
import { houseBidderProfile, requireBidderHouse, setHouseBidderBlock } from '$lib/server/sellerBidders.js';
export async function GET({ params, locals, url }) {
  const { house } = await requireBidderHouse(locals, params.id, { owner: true });
  const profile = await houseBidderProfile(params.id, params.bidderId, Object.fromEntries(url.searchParams));
  return json({ ...profile, house }, { headers: { 'cache-control': 'private, no-store' } });
}
export async function PATCH({ params, locals, request }) {
  const body = await request.json().catch(() => { throw error(400, 'A JSON body is required'); });
  if (!body || typeof body !== 'object') throw error(400, 'A JSON object is required');
  const result = await setHouseBidderBlock(locals, params.id, params.bidderId, { blocked: body.blocked, reason: body.reason });
  return json(result, { headers: { 'cache-control': 'private, no-store' } });
}
