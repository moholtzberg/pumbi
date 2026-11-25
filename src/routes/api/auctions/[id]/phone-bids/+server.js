import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission } from '$lib/server/authorization.js';
import { bidAmount, phoneCaller, phoneAuctionTerms, requireOpenLot, requirePhoneBuyer } from '$lib/server/bidRules.js';
import { submitMaximumBid } from '$lib/server/proxyBidding.js';

async function authorize(params, locals) {
  const user = await requireAuthenticatedUser(locals);
  const auction = await prisma.auction.findUnique({ where: { id: params.id }, include: { auctionHouse: true } });
  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_BIDDERS);
  if (auction.auctioneerId !== user.id) throw error(403, 'Only the assigned auctioneer can record phone bids');
  return { user, auction };
}

export async function GET({ params, locals, url }) {
  const { auction } = await authorize(params, locals);
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);
  const registrations = await prisma.auctionRegistration.findMany({
    where: {
      auctionId: params.id, status: 'APPROVED',
      ...(q ? { user: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } } : {})
    },
    select: { user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { createdAt: 'asc' }, take: 50
  });
  return json({ bidders: registrations.map(row => row.user), terms: phoneAuctionTerms(auction) }, { headers: { 'cache-control': 'no-store, private' } });
}

export async function POST({ params, locals, request }) {
  const { user } = await authorize(params, locals);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw error(403, 'Cross-origin phone bids are not allowed');
  const body = await request.json().catch(() => null);
  if (!body || !['existing', 'new'].includes(body.mode) || typeof body.lotId !== 'string') throw error(400, 'Choose a bidder and the current lot');
  if (body.callerConfirmed !== true) throw error(400, 'Confirm the caller’s identity and acceptance of the auction terms');
  const amount = bidAmount(body.amount);
  const caller = body.mode === 'new' ? phoneCaller(body.caller) : null;
  try {
    const result = await prisma.$transaction(async tx => {
      // Match the order used for auction completion; bids and hammering cannot
      // race each other into recording the wrong winner.
      await tx.$queryRaw`SELECT id FROM auctions WHERE id = ${params.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM lots WHERE id = ${body.lotId} AND auction_id = ${params.id} FOR UPDATE`;
      const lot = await tx.lot.findFirst({ where: { id: body.lotId, auctionId: params.id }, include: { auction: { include: { auctionHouse: true } } } });
      if (!lot) throw error(404, 'Lot not found in this auction');
      const auction = lot.auction;
      if (auction.auctioneerId !== user.id) throw error(403, 'Only the assigned auctioneer can record phone bids');
      const now = new Date();
      requireOpenLot(lot, now);
      if (auction.type === 'PUBLIC' && (!auction.platformPolicyId || auction.policyVersionSnapshot == null || !auction.buyerTermsSnapshot)) throw error(409, 'This auction is missing its bidding policy');
      if (String(body.acceptedTerms || '') !== phoneAuctionTerms(auction)) throw error(409, 'The auction terms changed. Reload the phone bid form and confirm them with the caller.');

      let buyer;
      let registration;
      let newBuyer = false;
      if (caller) {
        buyer = await tx.user.findFirst({ where: { email: { equals: caller.email, mode: 'insensitive' } }, select: { id: true, name: true, email: true } });
        if (buyer) {
          registration = await tx.auctionRegistration.findUnique({ where: { auctionId_userId: { auctionId: auction.id, userId: buyer.id } } });
          if (registration?.status === 'REJECTED') throw error(403, 'This caller’s registration was rejected. Review their bidder registration first.');
        } else {
          buyer = await tx.user.create({ data: { ...caller, role: 'BUYER', password: null }, select: { id: true, name: true, email: true } });
          newBuyer = true;
        }
      } else {
        if (typeof body.bidderId !== 'string' || !body.bidderId) throw error(400, 'Select an approved bidder');
        registration = await tx.auctionRegistration.findUnique({ where: { auctionId_userId: { auctionId: auction.id, userId: body.bidderId } }, include: { user: { select: { id: true, name: true, email: true } } } });
        if (registration?.status !== 'APPROVED') throw error(403, 'Select a bidder approved for this auction');
        buyer = registration.user;
      }
      requirePhoneBuyer(buyer, lot, user.id);
      const accepted = {
        status: 'APPROVED', reviewedById: user.id, reviewedAt: now,
        termsAcceptedAt: now,
        acceptedPolicyId: auction.type === 'PUBLIC' ? auction.platformPolicyId : null,
        acceptedPolicyVersion: auction.type === 'PUBLIC' ? auction.policyVersionSnapshot : null,
        acceptedBuyerTermsSnapshot: phoneAuctionTerms(auction) || null,
        termsAcceptedUserAgent: 'Caller consent recorded by auctioneer during a phone bid'
      };
      await tx.auctionRegistration.upsert({
        where: { auctionId_userId: { auctionId: auction.id, userId: buyer.id } },
        create: { auctionId: auction.id, userId: buyer.id, ...accepted }, update: accepted
      });
      // Never mark the caller's email, phone, identity, card, or online bidder
      // verification complete. This is a staff-recorded, attributed phone bid.
      const result = await submitMaximumBid(tx, { lot, buyer, maximum: amount, source: 'PHONE', recordedById: user.id, now });
      return { ...result, newBuyer };
    });
    return json(result, { status: 201, headers: { 'cache-control': 'no-store, private' } });
  } catch (err) {
    if (err.status) throw err;
    if (err.code === 'P2002') throw error(409, 'This caller was registered by another request. Search for them and try again.');
    console.error('Phone bid failed', { code: err.code, name: err.name });
    throw error(500, 'Unable to record the phone bid');
  }
}
