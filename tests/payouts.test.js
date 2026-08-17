import test from 'node:test';
import assert from 'node:assert/strict';
import {
  amountToMinorUnits,
  parsePayoutRequest
} from '../src/lib/server/payouts.js';

test('payout amounts convert to exact minor units', () => {
  assert.equal(amountToMinorUnits('12.34'), 1234);
  assert.equal(amountToMinorUnits('12.3'), 1230);
  assert.equal(amountToMinorUnits('12'), 1200);
});

test('payout request validation normalizes whitelisted fields', () => {
  assert.deepEqual(parsePayoutRequest({
    amount: '12.34',
    currency: ' USD ',
    sourceReference: ' settlement-123 ',
    reason: ' Seller settlement ',
    destination: 'acct_untrusted'
  }), {
    amount: '12.34',
    currency: 'usd',
    sourceReference: 'settlement-123',
    reason: 'Seller settlement'
  });
});

test('payout amounts reject invalid or non-positive values', () => {
  for (const value of ['0', '-1', '1.234', '1e2', 'not-a-number']) {
    assert.throws(() => amountToMinorUnits(value));
  }
});
