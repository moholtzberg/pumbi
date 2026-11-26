import test from 'node:test';
import assert from 'node:assert/strict';
import {
  minimumLotBid,
  lotBidIncrement,
  publicLotBidRules,
  resolveBidIncrementSchedule,
} from '../src/lib/utils/bidIncrements.js';
const rows = [
  { from: 0, increment: 5 },
  { from: 50, increment: 10 },
  { from: 200, increment: 20 },
  { from: 1000, increment: 100 },
];
const lot = (currentBid) => ({
  startingBid: 25,
  currentBid,
  bidIncrement: 5,
  highestBidderId: 'buyer',
  auction: {
    settings: {},
    auctionHouse: { settings: { bidIncrements: rows } },
  },
});
test('configured increments rise at inclusive tier thresholds', () => {
  for (const [current, increment, minimum] of [
    [25, 5, 30],
    [45, 5, 50],
    [50, 10, 60],
    [199, 10, 209],
    [200, 20, 220],
    [999, 20, 1019],
    [1000, 100, 1100],
    [10000, 100, 10100],
  ]) {
    assert.equal(lotBidIncrement(lot(current)), increment);
    assert.equal(minimumLotBid(lot(current)), minimum);
  }
});
test('auction override, house schedule and lot fallback have a single precedence', () => {
  const sample = lot(1000);
  sample.auction.settings = { bidIncrements: [{ from: 0, increment: 25 }] };
  assert.equal(lotBidIncrement(sample), 25);
  assert.equal(resolveBidIncrementSchedule(sample.auction).source, 'auction');
  sample.auction.settings.bidIncrements = [];
  assert.equal(lotBidIncrement(sample), 100);
  sample.auction.auctionHouse.settings.bidIncrements = [];
  sample.auction.privateHouseRateConfigSnapshot = { bidIncrements: rows };
  assert.equal(lotBidIncrement(sample), 5);
  assert.equal(resolveBidIncrementSchedule(sample.auction).source, 'lot');
});
test('a published public policy schedule cannot be overridden by house or auction controls', () => {
  const sample = lot(1000);
  sample.auction.type = 'PUBLIC';
  sample.auction.settings = { bidIncrements: [{ from: 0, increment: 25 }] };
  sample.auction.rateConfigSnapshot = {
    bidIncrements: [{ from: 0, increment: 50 }],
  };
  assert.equal(lotBidIncrement(sample), 50);
  assert.equal(resolveBidIncrementSchedule(sample.auction).source, 'policy');
});
test('opening bid is the start price rather than an unrelated high fixed increment', () => {
  assert.equal(
    minimumLotBid({ startingBid: 25, currentBid: 0, bidIncrement: 100 }),
    25,
  );
  assert.equal(
    minimumLotBid({ startingBid: 0, currentBid: 0, bidIncrement: 5 }),
    5,
  );
  assert.equal(
    minimumLotBid({ startingBid: 0, currentBid: 0.1, bidIncrement: 0.2 }),
    0.3,
  );
});
test('client bid rules match server calculations and update when current price moves to a new tier', () => {
  const source = lot(990);
  const rules = publicLotBidRules(source);
  const publicLot = {
    startingBid: source.startingBid,
    currentBid: 990,
    bidIncrement: 5,
    highestBidderId: 'buyer',
    ...rules,
  };
  assert.equal(minimumLotBid(publicLot), minimumLotBid(source));
  publicLot.currentBid = 1000;
  assert.equal(minimumLotBid(publicLot), 1100);
  assert.deepEqual(Object.keys(rules).sort(), [
    'bidIncrementSchedule',
    'bidIncrementSource',
    'effectiveBidIncrement',
    'minimumBid',
  ]);
});
