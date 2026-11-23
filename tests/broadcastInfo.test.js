import test from 'node:test';
import assert from 'node:assert/strict';
import { broadcastInfo } from '../src/lib/utils/broadcastInfo.js';

test('broadcast graphics use the actual house, current lot, high bid and next lot', () => {
  const result = broadcastInfo({ auction: { title: 'Winter auction', auctionHouse: { name: 'Hadar' } }, currentLot: { id: 'current', lotNumber: 12, title: 'Silver cup', currentBid: 180, startingBid: 100, endTime: '2026-11-23T12:00:00Z' }, nextLot: { id: 'next', lotNumber: 13, title: 'Siddur' }, biddingOpen: true });
  assert.equal(result.platform, 'Pumbi');
  assert.equal(result.house, 'Hadar');
  assert.equal(result.currentLot.price, 180);
  assert.equal(result.currentLot.priceLabel, 'Current bid');
  assert.equal(result.currentLot.endTime, '2026-11-23T12:00:00Z');
  assert.equal(result.nextLot.lotNumber, 13);
});

test('lobby graphics use opening price, hide inactive timers and omit duplicate next lots', () => {
  const lot = { id: 'current', lotNumber: 1, startingBid: 25, currentBid: 0, endTime: '2026-11-23T12:00:00Z' };
  const result = broadcastInfo({ auction: { privateHouseNameSnapshot: 'Snapshot house' }, currentLot: lot, nextLot: lot, biddingOpen: false });
  assert.equal(result.house, 'Snapshot house');
  assert.equal(result.currentLot.price, 25);
  assert.equal(result.currentLot.priceLabel, 'Opening bid');
  assert.equal(result.currentLot.endTime, null);
  assert.equal(result.nextLot, null);
});

test('empty rooms do not invent lots, bidders or bids', () => {
  const result = broadcastInfo({ auction: null });
  assert.equal(result.currentLot, null);
  assert.equal(result.nextLot, null);
  assert.equal(result.biddingOpen, false);
});
