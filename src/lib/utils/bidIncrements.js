import { readSettings } from './region.js';

export const STANDARD_BID_INCREMENTS = Object.freeze([
  { from: 0, increment: 5 },
  { from: 50, increment: 10 },
  { from: 200, increment: 20 },
  { from: 500, increment: 50 },
  { from: 1000, increment: 100 },
  { from: 2000, increment: 200 },
  { from: 5000, increment: 500 },
  { from: 10000, increment: 1000 },
  { from: 20000, increment: 2000 },
  { from: 50000, increment: 5000 },
  { from: 100000, increment: 10000 },
]);
const cents = (value) => Math.round(Number(value) * 100);
function usableRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (row) =>
        row &&
        Number.isFinite(Number(row.from)) &&
        Number(row.from) >= 0 &&
        Number.isFinite(Number(row.increment)) &&
        Number(row.increment) > 0,
    )
    .map((row) => ({
      from: Number(row.from),
      increment: Number(row.increment),
    }))
    .sort((a, b) => a.from - b.from);
}

export function resolveBidIncrementSchedule(
  auction = {},
  auctionHouse = auction?.auctionHouse || {},
) {
  // Published public policies remain authoritative for platform auctions.
  const policy = usableRows(
    readSettings(auction?.rateConfigSnapshot).bidIncrements,
  );
  if (String(auction?.type).toUpperCase() === 'PUBLIC' && policy.length)
    return { rows: policy, source: 'policy' };
  const override = usableRows(readSettings(auction?.settings).bidIncrements);
  if (override.length) return { rows: override, source: 'auction' };
  const house = usableRows(readSettings(auctionHouse?.settings).bidIncrements);
  if (house.length) return { rows: house, source: 'house' };
  return { rows: [], source: 'lot' };
}

export function lotBidIncrement(
  lot,
  amount = Number(lot.currentBid) > 0 ? lot.currentBid : lot.startingBid,
) {
  const rows = Array.isArray(lot.bidIncrementSchedule)
    ? lot.bidIncrementSchedule
    : resolveBidIncrementSchedule(lot.auction).rows;
  const threshold = cents(amount);
  const match = [...rows]
    .reverse()
    .find((row) => cents(row.from) <= threshold && cents(row.increment) > 0);
  const fixed = cents(lot.bidIncrement);
  return (
    (match
      ? cents(match.increment)
      : Number.isSafeInteger(fixed) && fixed > 0
        ? fixed
        : 1) / 100
  );
}

export function minimumLotBid(lot) {
  const current = cents(lot.currentBid || 0);
  const starting = cents(lot.startingBid || 0);
  if (!lot.highestBidderId && current <= 0 && starting > 0)
    return starting / 100;
  return (
    Math.max(starting, current + cents(lotBidIncrement(lot, current / 100))) /
    100
  );
}

export function publicLotBidRules(lot, auction = lot.auction) {
  const { rows, source } = resolveBidIncrementSchedule(auction);
  const withRules = { ...lot, bidIncrementSchedule: rows };
  return {
    bidIncrementSchedule: rows,
    bidIncrementSource: source,
    effectiveBidIncrement: lotBidIncrement(withRules),
    minimumBid: minimumLotBid(withRules),
  };
}
