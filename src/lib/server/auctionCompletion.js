import prisma from '$lib/prisma.js';
import { parseAuctionSettings } from '$lib/server/liveAuctionFloor.js';
import { resolveLotTiming } from '$lib/server/lotTiming.js';

// Runtime state must survive ordinary settings saves and cannot be supplied by
// a settings form to enable extra rounds or reset a completed round.
export function preserveRelistState(current, incoming) {
  const existing = parseAuctionSettings(current);
  const next = { ...parseAuctionSettings(incoming) };
  delete next.unsoldRelistRoundStartedAt;
  delete next.unsoldRelistCount;
  if (existing.unsoldRelistRoundStartedAt) {
    next.unsoldRelistRoundStartedAt = existing.unsoldRelistRoundStartedAt;
    next.unsoldRelistCount = existing.unsoldRelistCount || 0;
  }
  return next;
}

export async function finishOrRelistAuction({ auctionId, now = new Date(), markRemainingUnsold = false, scheduled = false, client = prisma }) {
  return client.$transaction(async tx => {
    // Serialize completion requests so simultaneous close/end/cron requests
    // cannot enqueue the same unsold round twice.
    await tx.$queryRaw`SELECT id FROM auctions WHERE id = ${auctionId} FOR UPDATE`;
    const auction = await tx.auction.findUnique({ where: { id: auctionId }, include: { auctionHouse: true } });
    if (!auction) throw Object.assign(new Error('Auction not found'), { status: 404 });
    const settings = parseAuctionSettings(auction.settings);
    const enabled = parseAuctionSettings(auction.auctionHouse.settings).relistUnsoldLotsAtEnd === true;
    if (['ENDED', 'CANCELLED'].includes(auction.status)) return { auction, auctionEnded: true, relistedCount: 0, skipped: true };
    if (scheduled && (auction.auctioneerStartedAt || auction.endDate > now)) return { auction, auctionEnded: false, relistedCount: 0, skipped: true };
    if (!scheduled) {
      const block = settings.onBlockLotId && await tx.lot.findFirst({ where: { id: settings.onBlockLotId, auctionId, status: 'ACTIVE' }, select: { lotNumber: true } });
      if (block) throw Object.assign(new Error(`Hammer lot #${block.lotNumber} before ending the auction`), { status: 409 });
      const open = await tx.lot.findFirst({
        where: { auctionId, status: 'ACTIVE', isReady: true, endTime: { gt: now } },
        select: { lotNumber: true }
      });
      if (open) throw Object.assign(new Error(`Close lot #${open.lotNumber} before ending the auction`), { status: 409 });
    }
    if (markRemainingUnsold || (scheduled && enabled)) {
      await tx.lot.updateMany({
        where: { auctionId, status: 'ACTIVE', isReady: true, ...(scheduled ? { highestBidderId: null } : {}) },
        data: { status: 'UNSOLD', endTime: now, fairWarningAt: null, fairWarningKey: null }
      });
    } else if (!scheduled && await tx.lot.count({ where: { auctionId, status: 'ACTIVE', isReady: true } })) {
      return { auction, auctionEnded: false, relistedCount: 0, skipped: true };
    }

    const unsold = enabled && !settings.unsoldRelistRoundStartedAt ? await tx.lot.findMany({
      where: { auctionId, status: 'UNSOLD', isReady: true, highestBidderId: null, invoice: { is: null }, bids: { none: {} } },
      orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }]
    }) : [];

    if (unsold.length) {
      await tx.lot.updateMany({
        where: { id: { in: unsold.map(lot => lot.id) } },
        data: { status: 'ACTIVE', currentBid: 0, highestBidderId: null, highestBidderName: null, endTime: null, fairWarningAt: null, fairWarningKey: null }
      });
      let nextLot = null;
      const nextSettings = { ...settings, onBlockLotId: null, unsoldRelistRoundStartedAt: now.toISOString(), unsoldRelistCount: unsold.length };
      const floor = Boolean(auction.auctioneerStartedAt);
      const { initialTimerSeconds } = resolveLotTiming({ lot: unsold[0], auction, auctionHouse: auction.auctionHouse });
      let endDate = new Date(now.getTime() + (floor ? (initialTimerSeconds + 60) * 1000 : Math.max(60_000, auction.endDate.getTime() - auction.startDate.getTime())));
      if (floor && settings.autoAdvanceNextLot) {
        nextLot = await tx.lot.update({ where: { id: unsold[0].id }, data: { endTime: new Date(now.getTime() + initialTimerSeconds * 1000) } });
        nextSettings.onBlockLotId = nextLot.id;
      }
      if (auction.endDate > endDate) endDate = auction.endDate;
      const updated = await tx.auction.update({
        where: { id: auctionId }, data: { status: 'LIVE', endDate, settings: JSON.stringify(nextSettings) }
      });
      return { auction: updated, auctionEnded: false, relistedCount: unsold.length, nextLot, skipped: false };
    }

    const updated = await tx.auction.update({
      where: { id: auctionId }, data: { status: 'ENDED', endDate: now, settings: JSON.stringify({ ...settings, onBlockLotId: null }) }
    });
    return { auction: updated, auctionEnded: true, relistedCount: 0, nextLot: null, skipped: false };
  });
}
