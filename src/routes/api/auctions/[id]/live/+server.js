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
    where: { auctionId: auction.id, status: 'ACTIVE', isReady: true },
    select: {
      id: true,
      position: true,
      lotNumber: true,
      endTime: true,
      title: true,
      currentBid: true,
      startingBid: true,
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
  const timedLots = lots
    .filter((lot) => lot.endTime && lot.endTime.getTime() > now)
    .sort((a, b) => a.endTime.getTime() - b.endTime.getTime() || a.position - b.position);
  const openLot = timedLots[0] || null;
  // Prefer the open lot; otherwise surface the next ready lot so bidders can still open details.
  const selected =
    openLot ||
    lots.find((lot) => !lot.endTime || lot.endTime.getTime() <= now) ||
    lots[0] ||
    null;
  const biddingOpen = Boolean(auction.auctioneerStartedAt && openLot && selected?.id === openLot.id);

  const upcomingRaw = lots
    .filter((lot) => lot.id !== selected?.id)
    .filter((lot) => !lot.endTime || lot.endTime.getTime() > now)
    .slice(0, 12);

  const { convertToPresignedUrl } = await import('$lib/utils/s3Presigned.js');

  const [currentLot, recentBids, upcomingLots] = await Promise.all([
    selected ? db.lots.getById(selected.id) : null,
    prisma.bid.findMany({
      where: { lot: { auctionId: auction.id } },
      include: { lot: { select: { lotNumber: true, title: true } } },
      orderBy: { timestamp: 'desc' },
      take: 20
    }),
    Promise.all(
      upcomingRaw.map(async (lot) => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        currentBid: lot.currentBid,
        startingBid: lot.startingBid,
        endTime: lot.endTime,
        imageUrl: await convertToPresignedUrl(lot.images[0]?.url || null)
      }))
    )
  ]);

  return json({
    auctioneerId: auction.auctioneerId,
    auctioneerStartedAt: auction.auctioneerStartedAt,
    lobby: !auction.auctioneerStartedAt,
    biddingOpen,
    currentLot,
    upcomingLots,
    timing: currentLot
      ? resolveLotTiming({ lot: currentLot, auction, auctionHouse: auction.auctionHouse })
      : null,
    recentBids: recentBids.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      bidderName: bid.userName,
      timestamp: bid.timestamp,
      lotNumber: bid.lot.lotNumber,
      lotTitle: bid.lot.title,
      isCurrentLot: bid.lotId === selected?.id
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
    if (action === 'start' || !auction.auctioneerStartedAt) {
      await prisma.auction.update({
        where: { id: auction.id },
        data: { status: 'LIVE', auctioneerStartedAt: new Date() }
      });
    } else if (auction.status !== 'LIVE') {
      await prisma.auction.update({
        where: { id: auction.id },
        data: { status: 'LIVE' }
      });
    }

    const updated = await prisma.lot.update({
      where: { id: lot.id },
      data: {
        status: 'ACTIVE',
        isReady: true,
        endTime: new Date(now + initialTimerSeconds * 1000)
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
