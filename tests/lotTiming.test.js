import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extendedEndTime,
  PLATFORM_LOT_TIMING,
  resolveLotTiming
} from '../src/lib/server/lotTiming.js';

test('lot timing uses the platform defaults', () => {
  assert.deepEqual(resolveLotTiming(), PLATFORM_LOT_TIMING);
});

test('lot timing inherits from house to auction to lot', () => {
  const auctionHouse = {
    settings: JSON.stringify({
      automaticAuctionInitialTimerSeconds: 75,
      automaticAuctionTimerResetSeconds: 40
    })
  };
  const auction = {
    settings: JSON.stringify({ automaticAuctionInitialTimerSeconds: 50 })
  };
  const lot = { bidExtensionSeconds: 20 };

  assert.deepEqual(resolveLotTiming({ auctionHouse, auction, lot }), {
    initialTimerSeconds: 50,
    bidExtensionSeconds: 20
  });
});

test('a bid below the threshold resets the remaining time', () => {
  const now = new Date('2026-08-19T12:00:00.000Z');
  const endTime = new Date('2026-08-19T12:00:10.000Z');
  assert.equal(
    extendedEndTime(endTime, now, 30).toISOString(),
    '2026-08-19T12:00:30.000Z'
  );
});

test('a bid at or above the threshold does not change the timer', () => {
  const now = new Date('2026-08-19T12:00:00.000Z');
  const endTime = new Date('2026-08-19T12:00:30.000Z');
  assert.equal(extendedEndTime(endTime, now, 30).toISOString(), endTime.toISOString());
});
