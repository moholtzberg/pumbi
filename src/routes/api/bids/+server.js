import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser } from '$lib/server/authorization.js';
import { auctionBidAccess } from '$lib/utils/biddingAccess.js';
import { submitMaximumBid } from '$lib/server/proxyBidding.js';
import { bidAmount, requireOpenLot } from '$lib/server/bidRules.js';

export async function GET({ url, locals }) {
  const lotId = url.searchParams.get('lotId');
  const userId = url.searchParams.get('userId');
  
  if (url.searchParams.get('view') === 'maximum') {
    const user = await requireAuthenticatedUser(locals);
    if (!lotId) throw error(400, 'lotId is required');
    const maximum = await prisma.proxyBid.findUnique({ where: { lotId_userId: { lotId, userId: user.id } }, select: { maxAmount: true } });
    return json({ maximumBid: maximum ? Number(maximum.maxAmount) : null }, { headers: { 'cache-control': 'private, no-store' } });
  }

  if (lotId) {
    const bids = await db.bids.getByLotId(lotId);
    return json(bids);
  }
  
  if (userId) {
    const bids = await db.bids.getByUserId(userId);
    return json(bids);
  }
  
  return json([]);
}

export async function POST({ request, locals }) {
  const user = await requireAuthenticatedUser(
    locals,
    'You must be logged in to place a bid'
  );
  const data = await request.json();
  const lotId = data.lotId;
  const amount = bidAmount(data.amount);
  
  if (typeof lotId !== 'string' || !lotId || !Number.isFinite(amount) || amount <= 0) {
    throw error(400, 'A valid lot ID and positive bid amount are required');
  }

  const bid = await prisma.$transaction(async (tx) => {
    const target = await tx.lot.findUnique({ where: { id: lotId }, select: { auctionId: true } });
    if (!target) throw error(404, 'Lot not found');
    await tx.$queryRaw`SELECT id FROM auctions WHERE id = ${target.auctionId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM lots WHERE id = ${lotId} FOR UPDATE`;
    const lot = await tx.lot.findUnique({
      where: { id: lotId },
      include: { auction: { include: { auctionHouse: true } } }
    });

    if (!lot) {
      throw error(404, 'Lot not found');
    }

    const auction = lot.auction;
    const now = new Date();
    requireOpenLot(lot, now);

    // Auctioneer-run sales are gated by LIVE status + lot timers, not the catalog endDate.
    // Scheduled start/end only apply before the auctioneer has opened the floor.
    if (auction.status !== 'LIVE') {
      throw error(409, 'This auction is not live');
    }

    if (!auction.auctioneerStartedAt) {
      if (now < auction.startDate || now >= auction.endDate) {
        throw error(409, 'This auction is not open for bidding');
      }
      throw error(409, 'The auctioneer has not started bidding yet');
    }

    if (
      lot.status !== 'ACTIVE' ||
      !lot.isReady ||
      (lot.endTime && now >= lot.endTime)
    ) {
      throw error(409, 'This lot is not open for bidding');
    }

    if ([auction.sellerId, lot.ownerUserId, auction.auctioneerId].includes(user.id)) {
      throw error(403, 'The seller, lot owner, and auctioneer cannot bid on this lot');
    }

    const registration = await tx.auctionRegistration.findUnique({
      where: {
        auctionId_userId: {
          auctionId: auction.id,
          userId: user.id
        }
      }
    });

    const access = auctionBidAccess(user, auction, registration);
    if (access.needsVerification) throw error(403, 'Complete buyer verification before placing a bid');
    if (access.registrationRequired && !access.policyConfigured) throw error(409, 'This public auction does not have a valid bidding policy');
    if (!access.readyToBid) throw error(403, access.approvalRequired ? 'Your registration must be approved before bidding' : 'You must accept this auction policy before bidding');

    return submitMaximumBid(tx, { lot, buyer: user, maximum: amount, now });
  });

  return json(bid, { status: 201, headers: { 'cache-control': 'private, no-store' } });
}
