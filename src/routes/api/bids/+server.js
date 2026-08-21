import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser } from '$lib/server/authorization.js';
import { extendedEndTime, resolveLotTiming } from '$lib/server/lotTiming.js';

export async function GET({ url }) {
  const lotId = url.searchParams.get('lotId');
  const userId = url.searchParams.get('userId');
  
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
  const amount = Number(data.amount);
  
  if (!lotId || !Number.isFinite(amount) || amount <= 0) {
    throw error(400, 'A valid lot ID and positive bid amount are required');
  }
  if (!user.isVerifiedBuyer) {
    throw error(403, 'Complete buyer verification before placing a bid');
  }

  const bid = await prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({
      where: { id: lotId },
      include: { auction: { include: { auctionHouse: true } } }
    });

    if (!lot) {
      throw error(404, 'Lot not found');
    }

    const auction = lot.auction;
    const now = new Date();

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

    if (lot.highestBidderId === user.id) {
      throw error(400, 'You are already the highest bidder on this lot');
    }

    if (auction.sellerId === user.id || lot.ownerUserId === user.id) {
      throw error(403, 'You cannot bid on your own lot');
    }

    const registration = await tx.auctionRegistration.findUnique({
      where: {
        auctionId_userId: {
          auctionId: auction.id,
          userId: user.id
        }
      }
    });

    if (auction.type === 'PRIVATE') {
      if (registration?.status !== 'APPROVED') {
        throw error(403, 'Your registration must be approved before bidding');
      }
    } else {
      if (
        !auction.platformPolicyId ||
        auction.policyVersionSnapshot == null ||
        !auction.buyerTermsSnapshot
      ) {
        throw error(409, 'This public auction does not have a valid bidding policy');
      }

      const acceptedAuctionPolicy = Boolean(
        registration?.status === 'APPROVED' &&
        registration.termsAcceptedAt &&
        registration.acceptedPolicyId === auction.platformPolicyId &&
        registration.acceptedPolicyVersion === auction.policyVersionSnapshot &&
        registration.acceptedBuyerTermsSnapshot === auction.buyerTermsSnapshot
      );

      if (!acceptedAuctionPolicy) {
        throw error(403, 'You must accept this auction policy before bidding');
      }
    }

    const minimumBid = Math.max(
      lot.startingBid,
      lot.currentBid + lot.bidIncrement
    );
    if (amount < minimumBid) {
      throw error(400, `Bid must be at least $${minimumBid}`);
    }

    const userName = user.name || user.email;
    const timing = resolveLotTiming({
      lot,
      auction,
      auctionHouse: auction.auctionHouse
    });
    const nextEndTime = extendedEndTime(lot.endTime, now, timing.bidExtensionSeconds);
    const updated = await tx.lot.updateMany({
      where: {
        id: lot.id,
        currentBid: lot.currentBid,
        highestBidderId: lot.highestBidderId
      },
      data: {
        currentBid: amount,
        highestBidderId: user.id,
        highestBidderName: userName,
        ...(nextEndTime && nextEndTime.getTime() !== lot.endTime?.getTime()
          ? { endTime: nextEndTime }
          : {})
      }
    });

    if (updated.count !== 1) {
      throw error(409, 'Another bid was placed first; refresh and try again');
    }

    return tx.bid.create({
      data: {
        lotId,
        userId: user.id,
        userName,
        amount
      }
    });
  });

  return json(bid, { status: 201 });
}
