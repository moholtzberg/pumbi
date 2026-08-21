import prisma from '$lib/prisma.js';
import { resolveLotTiming } from '$lib/server/lotTiming.js';

export function parseAuctionSettings(settings) {
  if (!settings) return {};
  if (typeof settings === 'object') return settings;
  try {
    const parsed = JSON.parse(settings);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function isAutoAdvanceEnabled(auction) {
  return Boolean(parseAuctionSettings(auction.settings).autoAdvanceNextLot);
}

export function getOnBlockLotId(auction) {
  const id = parseAuctionSettings(auction.settings).onBlockLotId;
  return typeof id === 'string' && id ? id : null;
}

async function writeAuctionSettings(auctionId, currentSettings, patch) {
  const merged = { ...parseAuctionSettings(currentSettings), ...patch };
  await prisma.auction.update({
    where: { id: auctionId },
    data: { settings: JSON.stringify(merged) }
  });
  return merged;
}

export async function findNextReadyLot(auctionId, excludeLotId = null) {
  const lots = await prisma.lot.findMany({
    where: {
      auctionId,
      status: 'ACTIVE',
      isReady: true,
      ...(excludeLotId ? { id: { not: excludeLotId } } : {})
    },
    orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }]
  });
  const now = Date.now();
  return (
    lots.find((lot) => !lot.endTime || lot.endTime.getTime() <= now) ||
    null
  );
}

export async function openLotOnBlock({
  auction,
  auctionHouse,
  lot,
  claimAuctioneerStart = false
}) {
  const now = Date.now();
  const onBlockLotId = getOnBlockLotId(auction);
  if (onBlockLotId && onBlockLotId !== lot.id) {
    const blocking = await prisma.lot.findFirst({
      where: { id: onBlockLotId, auctionId: auction.id, status: 'ACTIVE' },
      select: { id: true, lotNumber: true }
    });
    if (blocking) {
      const error = new Error(`Close lot #${blocking.lotNumber} before opening another lot`);
      error.status = 409;
      throw error;
    }
  }

  const openLots = await prisma.lot.findMany({
    where: {
      auctionId: auction.id,
      status: 'ACTIVE',
      isReady: true,
      endTime: { gt: new Date(now) },
      id: { not: lot.id }
    },
    select: { id: true, lotNumber: true }
  });
  if (openLots.length > 0) {
    const error = new Error(`Close lot #${openLots[0].lotNumber} before opening another lot`);
    error.status = 409;
    throw error;
  }
  if (lot.status !== 'ACTIVE' || !lot.isReady) {
    const error = new Error('Only active, ready lots can be opened for bidding');
    error.status = 409;
    throw error;
  }

  const { initialTimerSeconds } = resolveLotTiming({ lot, auction, auctionHouse });
  const lotEndTime = new Date(now + initialTimerSeconds * 1000);
  const auctionEndFloor = new Date(lotEndTime.getTime() + 60_000);
  const shouldStartAuctioneer = claimAuctioneerStart || !auction.auctioneerStartedAt;
  const settings = parseAuctionSettings(auction.settings);

  await prisma.auction.update({
    where: { id: auction.id },
    data: {
      status: 'LIVE',
      settings: JSON.stringify({ ...settings, onBlockLotId: lot.id }),
      ...(shouldStartAuctioneer ? { auctioneerStartedAt: new Date() } : {}),
      ...(auction.endDate.getTime() < auctionEndFloor.getTime()
        ? { endDate: auctionEndFloor }
        : {})
    }
  });

  // Keep in-memory auction settings in sync for callers that reuse the object.
  auction.settings = JSON.stringify({ ...settings, onBlockLotId: lot.id });

  return prisma.lot.update({
    where: { id: lot.id },
    data: {
      status: 'ACTIVE',
      isReady: true,
      endTime: lotEndTime
    }
  });
}

export async function clearOnBlockLot(auction) {
  const settings = parseAuctionSettings(auction.settings);
  if (!settings.onBlockLotId) return settings;
  const merged = await writeAuctionSettings(auction.id, settings, { onBlockLotId: null });
  auction.settings = JSON.stringify(merged);
  return merged;
}

export async function maybeAutoAdvanceAfterClose({
  auction,
  auctionHouse,
  closedLotId
}) {
  if (!isAutoAdvanceEnabled(auction)) {
    return { advanced: false, lot: null };
  }

  const nextLot = await findNextReadyLot(auction.id, closedLotId);
  if (!nextLot) {
    return { advanced: false, lot: null };
  }

  const opened = await openLotOnBlock({
    auction,
    auctionHouse,
    lot: nextLot,
    claimAuctioneerStart: false
  });
  return { advanced: true, lot: opened };
}

/**
 * Add seconds to the on-block lot timer.
 * If the timer already expired, time is added from now (revives bidding).
 */
export async function addTimeToLotOnBlock({ auction, lot, seconds }) {
  const amount = Number(seconds);
  if (!Number.isInteger(amount) || amount < 1 || amount > 3600) {
    const error = new Error('seconds must be an integer between 1 and 3600');
    error.status = 400;
    throw error;
  }
  if (lot.status !== 'ACTIVE' || !lot.isReady) {
    const error = new Error('Only an active, ready lot can receive more time');
    error.status = 409;
    throw error;
  }

  const now = Date.now();
  const onBlockLotId = getOnBlockLotId(auction);
  const isTimedOpen = Boolean(lot.endTime && lot.endTime.getTime() > now);
  if (onBlockLotId && onBlockLotId !== lot.id) {
    const error = new Error('Only the lot on the block can receive more time');
    error.status = 409;
    throw error;
  }
  if (!onBlockLotId && !isTimedOpen) {
    const error = new Error('Open a lot on the block before adding time');
    error.status = 409;
    throw error;
  }

  const base = Math.max(now, lot.endTime ? lot.endTime.getTime() : now);
  const lotEndTime = new Date(base + amount * 1000);
  const auctionEndFloor = new Date(lotEndTime.getTime() + 60_000);
  const settings = parseAuctionSettings(auction.settings);

  await prisma.auction.update({
    where: { id: auction.id },
    data: {
      status: 'LIVE',
      settings: JSON.stringify({ ...settings, onBlockLotId: lot.id }),
      ...(auction.endDate.getTime() < auctionEndFloor.getTime()
        ? { endDate: auctionEndFloor }
        : {})
    }
  });
  auction.settings = JSON.stringify({ ...settings, onBlockLotId: lot.id });

  return prisma.lot.update({
    where: { id: lot.id },
    data: { endTime: lotEndTime }
  });
}
