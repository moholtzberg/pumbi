import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { db } from '$lib/db.js';
import { resolveLotTiming } from '$lib/server/lotTiming.js';
import { requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission, HOUSE_PERMISSIONS } from '$lib/server/authorization.js';

export async function GET({ params }) {
  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    include: { auctionHouse: true }
  });
  if (!auction) throw error(404, 'Auction not found');

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
  if (!['claim', 'start', 'open', 'close'].includes(action)) {
    throw error(400, 'action must be claim, start, open, or close');
  }
  if (action !== 'claim' && !lotId && action !== 'start' && action !== 'open') {
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

  const lot = lotId
    ? await prisma.lot.findFirst({ where: { id: lotId, auctionId: auction.id } })
    : await prisma.lot.findFirst({
        where: { auctionId: auction.id, status: 'ACTIVE', isReady: true },
        orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }]
      });
  if (!lot) throw error(404, 'Lot not found in this auction');

  if (action === 'start' || action === 'open') {
    const now = Date.now();
    const openLots = await prisma.lot.findMany({
      where: {
        auctionId: auction.id,
        status: 'ACTIVE',
        isReady: true,
        endTime: { gt: new Date(now) },
        ...(lot.id ? { id: { not: lot.id } } : {})
      },
      select: { id: true, lotNumber: true }
    });
    if (openLots.length > 0) {
      throw error(409, `Close lot #${openLots[0].lotNumber} before opening another lot`);
    }

    if (lot.status !== 'ACTIVE' || !lot.isReady) {
      throw error(409, 'Only active, ready lots can be opened for bidding');
    }

    const { initialTimerSeconds } = resolveLotTiming({ lot, auction, auctionHouse: auction.auctionHouse });
    const lotEndTime = new Date(now + initialTimerSeconds * 1000);
    // Keep the auction window open at least through this lot so cron cannot end a live floor sale.
    const auctionEndFloor = new Date(lotEndTime.getTime() + 60_000);
    if (action === 'start' || !auction.auctioneerStartedAt) {
      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          status: 'LIVE',
          auctioneerStartedAt: new Date(),
          ...(auction.endDate.getTime() < auctionEndFloor.getTime()
            ? { endDate: auctionEndFloor }
            : {})
        }
      });
    } else {
      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          ...(auction.status !== 'LIVE' ? { status: 'LIVE' } : {}),
          ...(auction.endDate.getTime() < auctionEndFloor.getTime()
            ? { endDate: auctionEndFloor }
            : {})
        }
      });
    }

    const updated = await prisma.lot.update({
      where: { id: lot.id },
      data: {
        status: 'ACTIVE',
        isReady: true,
        endTime: lotEndTime
      }
    });
    return json({
      action,
      lot: { id: updated.id, endTime: updated.endTime, status: updated.status }
    });
  }

  // close
  if (lot.status !== 'ACTIVE') {
    throw error(409, 'Only an active lot can be closed');
  }
  const updated = await prisma.lot.update({
    where: { id: lot.id },
    data: { endTime: new Date(), status: lot.highestBidderId ? 'SOLD' : 'UNSOLD' }
  });
  return json({ action, lot: { id: updated.id, endTime: updated.endTime, status: updated.status } });
}
