import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission } from '$lib/server/authorization.js';
import { createStreamToken, stopAuctionStream, streamFinished, streamingConfigured } from '$lib/server/liveStreaming.js';

const headers = { 'cache-control': 'no-store, private' };

async function loadAuction(id) {
  const auction = await prisma.auction.findUnique({
    where: { id },
    select: { id: true, type: true, status: true, auctionHouseId: true, auctioneerId: true }
  });
  if (!auction) throw error(404, 'Auction not found');
  return auction;
}

async function requireBroadcaster(locals, auction) {
  const user = await requireAuthenticatedUser(locals);
  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);
  if (auction.auctioneerId !== user.id) throw error(403, 'Claim the auctioneer seat before broadcasting');
  return user;
}

export async function GET({ params }) {
  const auction = await loadAuction(params.id);
  return json({ configured: streamingConfigured(), finished: streamFinished(auction), auctioneerId: auction.auctioneerId }, { headers });
}

export async function POST({ params, request, locals }) {
  const auction = await loadAuction(params.id);
  const body = await request.json().catch(() => ({}));
  if (!['viewer', 'publisher'].includes(body.role)) throw error(400, 'Choose a viewer or publisher role');
  const publisher = body.role === 'publisher';
  const user = publisher ? await requireBroadcaster(locals, auction) : null;
  return json({ ...await createStreamToken(auction, publisher), publisherUserId: user?.id || null }, { headers });
}

export async function DELETE({ params, locals }) {
  const auction = await loadAuction(params.id);
  await requireBroadcaster(locals, auction);
  try { await stopAuctionStream(auction.id); } catch (err) {
    if (err.status) throw err;
    console.error('Unable to stop auction stream', err?.message);
    throw error(502, 'Unable to stop the live stream. Try again.');
  }
  return json({ stopped: true }, { headers });
}
