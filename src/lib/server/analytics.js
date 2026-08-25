import { randomBytes } from 'crypto';
import prisma from '$lib/prisma.js';
import { getAuthenticatedUser } from '$lib/server/authorization.js';

const MAX_DURATION_MS = 60 * 60 * 1000; // cap a single session at 1 hour
const HEARTBEAT_MAX_JUMP_MS = 2 * 60 * 1000;

function newSessionKey() {
  return `cvs_${randomBytes(16).toString('hex')}`;
}

export function visitorKeyFrom({ userId, anonId }) {
  if (userId) return `u:${userId}`;
  return `a:${anonId || 'unknown'}`;
}

async function entityExists(entityType, entityId) {
  if (entityType === 'AUCTION') {
    return Boolean(await prisma.auction.findUnique({ where: { id: entityId }, select: { id: true } }));
  }
  if (entityType === 'LOT') {
    return Boolean(await prisma.lot.findUnique({ where: { id: entityId }, select: { id: true } }));
  }
  return false;
}

async function bumpCounters({ entityType, entityId, isUnique, durationDeltaMs = 0 }) {
  const data = {
    viewCount: { increment: 1 },
    ...(isUnique ? { uniqueVisitorCount: { increment: 1 } } : {}),
    ...(durationDeltaMs > 0 ? { totalDwellMs: { increment: BigInt(durationDeltaMs) } } : {})
  };

  if (entityType === 'AUCTION') {
    await prisma.auction.update({ where: { id: entityId }, data });
  } else if (entityType === 'LOT') {
    await prisma.lot.update({ where: { id: entityId }, data });
  }
}

async function addDwell({ entityType, entityId, durationDeltaMs }) {
  if (durationDeltaMs <= 0) return;
  const data = { totalDwellMs: { increment: BigInt(durationDeltaMs) } };
  if (entityType === 'AUCTION') {
    await prisma.auction.update({ where: { id: entityId }, data });
  } else if (entityType === 'LOT') {
    await prisma.lot.update({ where: { id: entityId }, data });
  }
}

/**
 * Start a page-view session for an auction or lot.
 */
export async function startContentView({
  locals,
  entityType,
  entityId,
  anonId,
  path,
  referrer,
  userAgent
}) {
  if (!['AUCTION', 'LOT'].includes(entityType) || !entityId) {
    const error = new Error('entityType and entityId are required');
    error.status = 400;
    throw error;
  }
  if (!(await entityExists(entityType, entityId))) {
    const error = new Error('Entity not found');
    error.status = 404;
    throw error;
  }

  const user = await getAuthenticatedUser(locals);
  const visitorKey = visitorKeyFrom({ userId: user?.id, anonId });
  const sessionKey = newSessionKey();

  const prior = await prisma.contentView.findFirst({
    where: { entityType, entityId, visitorKey },
    select: { id: true }
  });
  const isUnique = !prior;

  await prisma.contentView.create({
    data: {
      entityType,
      entityId,
      visitorKey,
      userId: user?.id || null,
      sessionKey,
      path: path ? String(path).slice(0, 500) : null,
      referrer: referrer ? String(referrer).slice(0, 500) : null,
      userAgent: userAgent ? String(userAgent).slice(0, 300) : null
    }
  });

  await bumpCounters({ entityType, entityId, isUnique, durationDeltaMs: 0 });

  return { sessionKey, isUnique };
}

/**
 * Heartbeat / end: set absolute durationMs for the session (monotonic, capped).
 */
export async function touchContentView({ sessionKey, durationMs, ended = false }) {
  if (!sessionKey) {
    const error = new Error('sessionKey is required');
    error.status = 400;
    throw error;
  }

  const view = await prisma.contentView.findUnique({ where: { sessionKey } });
  if (!view) {
    const error = new Error('View session not found');
    error.status = 404;
    throw error;
  }

  const nextDuration = Math.min(
    MAX_DURATION_MS,
    Math.max(view.durationMs, Math.min(Number(durationMs) || 0, view.durationMs + HEARTBEAT_MAX_JUMP_MS))
  );
  const delta = Math.max(0, nextDuration - view.durationMs);

  await prisma.contentView.update({
    where: { id: view.id },
    data: {
      durationMs: nextDuration,
      lastSeenAt: new Date(),
      ...(ended ? { endedAt: new Date() } : {})
    }
  });

  if (delta > 0) {
    await addDwell({
      entityType: view.entityType,
      entityId: view.entityId,
      durationDeltaMs: delta
    });
  }

  return { durationMs: nextDuration };
}

export function summarizeInterest({ viewCount, uniqueVisitorCount, totalDwellMs }) {
  const views = Number(viewCount || 0);
  const uniques = Number(uniqueVisitorCount || 0);
  const dwell = Number(totalDwellMs || 0);
  return {
    viewCount: views,
    uniqueVisitorCount: uniques,
    totalDwellMs: dwell,
    avgDwellMs: views > 0 ? Math.round(dwell / views) : 0,
    avgDwellSeconds: views > 0 ? Math.round(dwell / views / 1000) : 0
  };
}

export async function getAuctionInterest(auctionId) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      title: true,
      viewCount: true,
      uniqueVisitorCount: true,
      totalDwellMs: true,
      lots: {
        select: {
          id: true,
          lotNumber: true,
          title: true,
          status: true,
          viewCount: true,
          uniqueVisitorCount: true,
          totalDwellMs: true
        },
        orderBy: [{ uniqueVisitorCount: 'desc' }, { viewCount: 'desc' }, { lotNumber: 'asc' }]
      }
    }
  });
  if (!auction) return null;

  return {
    auction: {
      id: auction.id,
      title: auction.title,
      ...summarizeInterest(auction)
    },
    lots: auction.lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      title: lot.title,
      status: lot.status,
      ...summarizeInterest(lot)
    }))
  };
}
