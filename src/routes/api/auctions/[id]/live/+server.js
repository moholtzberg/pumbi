import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { db } from '$lib/db.js';
import { resolveLotTiming } from '$lib/server/lotTiming.js';
import {
  findNextReadyLot,
  isAutoAdvanceEnabled,
  maybeAutoAdvanceAfterClose,
  openLotOnBlock,
  parseAuctionSettings,
  clearOnBlockLot,
  addTimeToLotOnBlock
} from '$lib/server/liveAuctionFloor.js';
import { requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission, HOUSE_PERMISSIONS } from '$lib/server/authorization.js';

export async function GET({ params }) {
  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    include: { auctionHouse: true }
  });
  if (!auction) throw error(404, 'Auction not found');

  if (auction.status === 'ENDED' || auction.status === 'CANCELLED') {
    return json({
      auctioneerId: auction.auctioneerId,
      auctioneerStartedAt: auction.auctioneerStartedAt,
      lobby: false,
      biddingOpen: false,
      auctionStatus: auction.status,
      finished: true,
      currentLot: null,
      pastLots: [],
      upcomingLots: [],
      lotRail: [],
      timing: null,
      recentBids: []
    }, { headers: { 'cache-control': 'no-store' } });
  }

  const lots = await prisma.lot.findMany({
    where: {
      auctionId: auction.id,
      isReady: true,
      status: { in: ['ACTIVE', 'SOLD', 'UNSOLD'] }
    },
    select: {
      id: true,
      position: true,
      lotNumber: true,
      endTime: true,
      title: true,
      status: true,
      currentBid: true,
      startingBid: true,
      highestBidderName: true,
      images: {
        where: { isHidden: false },
        orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
        take: 1,
        select: { url: true }
      }
    },
    orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }]
  });
  const now = Date.now();
  const activeLots = lots.filter((lot) => lot.status === 'ACTIVE');
  const timedLots = activeLots
    .filter((lot) => lot.endTime && lot.endTime.getTime() > now)
    .sort((a, b) => a.endTime.getTime() - b.endTime.getTime() || a.position - b.position);
  const openLot = timedLots[0] || null;
  // Prefer the open lot; otherwise surface the next ready lot so bidders can still open details.
  const selected =
    openLot ||
    activeLots.find((lot) => !lot.endTime || lot.endTime.getTime() <= now) ||
    activeLots[0] ||
    null;
  const biddingOpen = Boolean(auction.auctioneerStartedAt && openLot && selected?.id === openLot.id);

  const { convertToPresignedUrl } = await import('$lib/utils/s3Presigned.js');

  function lotPhase(lot) {
    if (selected && lot.id === selected.id) return 'current';
    if (lot.status === 'SOLD' || lot.status === 'UNSOLD') return 'past';
    if (lot.endTime && lot.endTime.getTime() <= now) return 'past';
    if (selected) {
      const selectedIndex = lots.findIndex((entry) => entry.id === selected.id);
      const lotIndex = lots.findIndex((entry) => entry.id === lot.id);
      if (selectedIndex >= 0 && lotIndex >= 0 && lotIndex < selectedIndex) return 'past';
    }
    return 'upcoming';
  }

  const [currentLot, lotBids, lotRail] = await Promise.all([
    selected ? db.lots.getById(selected.id) : null,
    selected
      ? prisma.bid.findMany({
          where: { lotId: selected.id },
          orderBy: { timestamp: 'desc' },
          take: 40
        })
      : Promise.resolve([]),
    Promise.all(
      lots.map(async (lot) => {
        const phase = lotPhase(lot);
        return {
          id: lot.id,
          lotNumber: lot.lotNumber,
          title: lot.title,
          status: lot.status,
          phase,
          currentBid: lot.currentBid,
          startingBid: lot.startingBid,
          highestBidderName: lot.highestBidderName,
          endTime: lot.endTime,
          imageUrl: await convertToPresignedUrl(lot.images[0]?.url || null)
        };
      })
    )
  ]);

  const pastLots = lotRail.filter((lot) => lot.phase === 'past');
  const upcomingLots = lotRail.filter((lot) => lot.phase === 'upcoming');

  return json({
    auctioneerId: auction.auctioneerId,
    auctioneerStartedAt: auction.auctioneerStartedAt,
    lobby: !auction.auctioneerStartedAt,
    biddingOpen,
    autoAdvanceNextLot: isAutoAdvanceEnabled(auction),
    currentLot,
    pastLots,
    upcomingLots,
    lotRail,
    timing: currentLot
      ? resolveLotTiming({ lot: currentLot, auction, auctionHouse: auction.auctionHouse })
      : null,
    recentBids: lotBids.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      bidderName: bid.userName,
      timestamp: bid.timestamp
    }))
  }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST({ params, request, locals }) {
  const user = await requireAuthenticatedUser(locals, 'Authentication required');
  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    include: { auctionHouse: true }
  });
  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);

  const body = await request.json();
  const lotId = String(body.lotId || '');
  const action = String(body.action || '').toLowerCase();
  if (!['claim', 'start', 'open', 'close', 'end', 'settings', 'extend'].includes(action)) {
    throw error(400, 'action must be claim, start, open, close, end, settings, or extend');
  }
  if (
    action !== 'claim' &&
    action !== 'end' &&
    action !== 'settings' &&
    !lotId &&
    action !== 'start' &&
    action !== 'open'
  ) {
    throw error(400, 'lotId is required for this action');
  }

  if (action === 'claim') {
    const claimed = await prisma.auction.updateMany({
      where: { id: auction.id, auctioneerId: null },
      data: { auctioneerId: user.id }
    });
    if (claimed.count !== 1 && auction.auctioneerId !== user.id) {
      throw error(409, 'Another team member is already the auctioneer for this auction');
    }
    return json({ action, auctioneerId: user.id });
  }

  if (auction.auctioneerId !== user.id) {
    throw error(403, 'Claim the auctioneer seat before controlling the auction');
  }

  if (action === 'settings') {
    if (typeof body.autoAdvanceNextLot !== 'boolean') {
      throw error(400, 'autoAdvanceNextLot must be a boolean');
    }
    const current = parseAuctionSettings(auction.settings);
    const merged = {
      ...current,
      autoAdvanceNextLot: body.autoAdvanceNextLot
    };
    await prisma.auction.update({
      where: { id: auction.id },
      data: { settings: JSON.stringify(merged) }
    });
    return json({
      action,
      autoAdvanceNextLot: Boolean(merged.autoAdvanceNextLot)
    });
  }

  if (action === 'end') {
    if (auction.status === 'ENDED' || auction.status === 'CANCELLED') {
      throw error(409, 'This auction is already finished');
    }

    const now = new Date();
    const openLots = await prisma.lot.findMany({
      where: {
        auctionId: auction.id,
        status: 'ACTIVE',
        isReady: true,
        endTime: { gt: now }
      },
      select: { id: true, lotNumber: true }
    });
    if (openLots.length > 0) {
      throw error(409, `Close lot #${openLots[0].lotNumber} before ending the auction`);
    }

    // Any remaining queued ready lots are marked unsold when the auctioneer ends the sale.
    await prisma.lot.updateMany({
      where: { auctionId: auction.id, status: 'ACTIVE', isReady: true },
      data: { status: 'UNSOLD', endTime: now }
    });

    await clearOnBlockLot(auction);

    const ended = await prisma.auction.update({
      where: { id: auction.id },
      data: { status: 'ENDED', endDate: now }
    });
    return json({
      action,
      auction: { id: ended.id, status: ended.status, endDate: ended.endDate }
    });
  }

  const lot = lotId
    ? await prisma.lot.findFirst({ where: { id: lotId, auctionId: auction.id } })
    : await findNextReadyLot(auction.id);
  if (!lot) throw error(404, 'Lot not found in this auction');

  if (action === 'start' || action === 'open') {
    if (auction.status === 'ENDED' || auction.status === 'CANCELLED') {
      throw error(409, 'This auction has ended');
    }
    try {
      const updated = await openLotOnBlock({
        auction,
        auctionHouse: auction.auctionHouse,
        lot,
        claimAuctioneerStart: action === 'start' || !auction.auctioneerStartedAt
      });
      return json({
        action,
        lot: { id: updated.id, endTime: updated.endTime, status: updated.status }
      });
    } catch (err) {
      if (err.status) throw error(err.status, err.message);
      throw err;
    }
  }

  if (action === 'extend') {
    if (auction.status === 'ENDED' || auction.status === 'CANCELLED') {
      throw error(409, 'This auction has ended');
    }
    const { bidExtensionSeconds } = resolveLotTiming({
      lot,
      auction,
      auctionHouse: auction.auctionHouse
    });
    const seconds =
      body.seconds === undefined || body.seconds === null || body.seconds === ''
        ? bidExtensionSeconds
        : Number(body.seconds);
    try {
      const updated = await addTimeToLotOnBlock({ auction, lot, seconds });
      return json({
        action,
        seconds: Number(seconds),
        lot: { id: updated.id, endTime: updated.endTime, status: updated.status }
      });
    } catch (err) {
      if (err.status) throw error(err.status, err.message);
      throw err;
    }
  }

  // close lot
  if (lot.status !== 'ACTIVE') {
    throw error(409, 'Only an active lot can be closed');
  }
  const updated = await prisma.lot.update({
    where: { id: lot.id },
    data: { endTime: new Date(), status: lot.highestBidderId ? 'SOLD' : 'UNSOLD' }
  });
  await clearOnBlockLot(auction);

  let invoice = null;
  if (updated.status === 'SOLD' && lot.highestBidderId) {
    try {
      const { createInvoiceForSoldLot } = await import('$lib/server/invoices.js');
      invoice = await createInvoiceForSoldLot(updated.id);
    } catch (err) {
      console.error('Failed to create invoice for sold lot', updated.id, err);
    }
  }

  const remainingReady = await prisma.lot.count({
    where: {
      auctionId: auction.id,
      isReady: true,
      status: 'ACTIVE',
      id: { not: updated.id }
    }
  });

  let auctionEnded = false;
  let advancedLot = null;
  if (remainingReady === 0 && auction.auctioneerStartedAt) {
    await prisma.auction.update({
      where: { id: auction.id },
      data: { status: 'ENDED', endDate: new Date() }
    });
    auctionEnded = true;
  } else {
    const advance = await maybeAutoAdvanceAfterClose({
      auction,
      auctionHouse: auction.auctionHouse,
      closedLotId: updated.id
    });
    if (advance.advanced) {
      advancedLot = {
        id: advance.lot.id,
        endTime: advance.lot.endTime,
        status: advance.lot.status,
        lotNumber: advance.lot.lotNumber,
        title: advance.lot.title
      };
    }
  }

  return json({
    action,
    lot: { id: updated.id, endTime: updated.endTime, status: updated.status },
    auctionEnded,
    autoAdvanced: Boolean(advancedLot),
    nextLot: advancedLot,
    invoiceId: invoice?.id || null
  });
}
