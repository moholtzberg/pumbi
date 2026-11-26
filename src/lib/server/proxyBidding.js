import { error } from '@sveltejs/kit';
import { lockHouseBidderAccess, requireUnblockedBidder } from '$lib/server/bidderAccess.js';
import { auctionBidAccess } from '$lib/utils/biddingAccess.js';
import { minimumLotBid, lotBidIncrement } from '$lib/utils/bidIncrements.js';
import { formatMoney } from '$lib/utils/region.js';
import { extendedEndTime, resolveLotTiming } from './lotTiming.js';

const cents = value => Math.round(Number(value) * 100);
const dollars = value => value / 100;

export function resolveProxyPrice(lot, candidates) {
  const current = cents(lot.currentBid);
  const entries = new Map(candidates.map(candidate => [candidate.userId, { ...candidate, limit: cents(candidate.maxAmount) }]));
  // Existing bids placed before proxy bidding remain binding at their public price.
  if (lot.highestBidderId) {
    const incumbent = entries.get(lot.highestBidderId);
    entries.set(lot.highestBidderId, { userId: lot.highestBidderId, userName: lot.highestBidderName, ...incumbent, limit: Math.max(current, incumbent?.limit || 0) });
  }
  const ranked = [...entries.values()].sort((a, b) => b.limit - a.limit ||
    (a.userId === lot.highestBidderId ? -1 : b.userId === lot.highestBidderId ? 1 : 0) ||
    (new Date(a.priorityAt || 0) - new Date(b.priorityAt || 0)) || a.userId.localeCompare(b.userId));
  const [winner, runnerUp] = ranked;
  if (!winner) throw new Error('No valid maximum bid');
  const floor = lot.highestBidderId ? current : cents(minimumLotBid(lot));
  const price = Math.min(winner.limit, Math.max(current, floor, runnerUp ? runnerUp.limit + cents(lotBidIncrement(lot, dollars(runnerUp.limit))) : floor));
  return { winner, price: dollars(price) };
}

function eligibleProxy(proxy, registration, lot) {
  if (!proxy.user || [lot.auction.sellerId, lot.ownerUserId, lot.auction.auctioneerId].includes(proxy.userId)) return false;
  return auctionBidAccess(proxy.user, lot.auction, registration, { phone: proxy.source === 'PHONE' }).readyToBid;
}

// Both callers hold the auction lock followed by the lot lock, and have checked
// the incoming bidder's authorization, registration, consent and open-lot timer.
export async function submitMaximumBid(tx, { lot, buyer, maximum, source = 'ONLINE', recordedById = null, now = new Date() }) {
  await lockHouseBidderAccess(tx, lot.auction.auctionHouseId);
  await requireUnblockedBidder(tx, lot.auction.auctionHouseId, buyer.id);
  const previous = await tx.proxyBid.findUnique({ where: { lotId_userId: { lotId: lot.id, userId: buyer.id } } });
  const previousLimit = previous ? Number(previous.maxAmount) : 0;
  const leading = lot.highestBidderId === buyer.id;
  if (maximum <= previousLimit || (leading && maximum <= Number(lot.currentBid))) throw error(400, 'Your new maximum must be higher than your existing maximum');
  if (!leading && maximum < minimumLotBid(lot)) throw error(400, `Maximum bid must be at least ${formatMoney(minimumLotBid(lot), lot.auction?.currency || 'usd')}`);
  const userName = buyer.name || buyer.email || 'Bidder';
  const commitment = { userName, maxAmount: maximum, source, recordedById, priorityAt: now };
  await tx.proxyBid.upsert({ where: { lotId_userId: { lotId: lot.id, userId: buyer.id } }, create: { lotId: lot.id, userId: buyer.id, ...commitment }, update: commitment });
  // Raising your own ceiling never bids against yourself, including when you
  // currently hold an equal-maximum tie against another bidder.
  if (leading) return { bid: null, currentBid: Number(lot.currentBid), highestBidderId: buyer.id, highestBidderName: lot.highestBidderName || userName, maximumBid: maximum, isLeading: true, maxUpdatedOnly: true, endTime: lot.endTime };
  const proxies = await tx.proxyBid.findMany({ where: { lotId: lot.id }, include: { user: { select: { id: true, isVerifiedBuyer: true } } } });
  const registrations = await tx.auctionRegistration.findMany({ where: { auctionId: lot.auctionId, userId: { in: proxies.map(proxy => proxy.userId) } } });
  const byUser = new Map(registrations.map(registration => [registration.userId, registration]));
  const blocks = await tx.bidderBlock.findMany({ where: { auctionHouseId: lot.auction.auctionHouseId, active: true, userId: { in: proxies.map(proxy => proxy.userId) } }, select: { userId: true } });
  const blocked = new Set(blocks.map(row => row.userId));
  const active = proxies.filter(proxy => !blocked.has(proxy.userId) && (proxy.userId === buyer.id || eligibleProxy(proxy, byUser.get(proxy.userId), lot)));
  const { winner, price } = resolveProxyPrice(lot, active);
  const changed = price !== Number(lot.currentBid) || winner.userId !== lot.highestBidderId;
  let lastBid = null;
  let endTime = lot.endTime;
  if (changed) {
    // A losing offer is a real public bid only up to its effective competing price.
    // Use the post-lock clock, not PostgreSQL's transaction-start default: a
    // competing transaction may have begun earlier while waiting for this lock.
    if (winner.userId !== buyer.id) await tx.bid.create({ data: { lotId: lot.id, userId: buyer.id, userName, amount: Math.min(maximum, price), source, recordedById, isAutomatic: false, timestamp: now } });
    lastBid = await tx.bid.create({ data: { lotId: lot.id, userId: winner.userId, userName: winner.userName || 'Bidder', amount: price, source: winner.source || 'ONLINE', recordedById: winner.recordedById || null, isAutomatic: winner.userId !== buyer.id, timestamp: now } });
    const timing = resolveLotTiming({ lot, auction: lot.auction, auctionHouse: lot.auction.auctionHouse });
    endTime = extendedEndTime(lot.endTime, now, timing.bidExtensionSeconds);
    await tx.lot.update({ where: { id: lot.id }, data: { currentBid: price, highestBidderId: winner.userId, highestBidderName: winner.userName || 'Bidder', fairWarningAt: null, fairWarningKey: null, endTime } });
  }
  return {
    bid: lastBid ? { id: lastBid.id, lotId: lot.id, userName: lastBid.userName, amount: price, source: lastBid.source, isAutomatic: lastBid.isAutomatic, timestamp: lastBid.timestamp } : null,
    currentBid: price, highestBidderId: winner.userId, highestBidderName: winner.userName,
    maximumBid: maximum, isLeading: winner.userId === buyer.id, maxUpdatedOnly: !changed, endTime
  };
}
