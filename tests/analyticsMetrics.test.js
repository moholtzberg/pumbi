import test from 'node:test';
import assert from 'node:assert/strict';
import { VisibleViewSession } from '../src/lib/utils/viewSession.js';
import { chartPoints, stepPath } from '../src/lib/utils/bidChart.js';
import { summarizeSellerMetrics } from '../src/lib/utils/sellerMetrics.js';

test('visibility changes reuse the view and exclude hidden time from dwell', async () => {
  let now = 0;
  const calls = [];
  const session = new VisibleViewSession({ now: () => now, request: async (action, payload) => {
    calls.push({ action, ...payload }); return { sessionKey: 'session-1' };
  } });
  await session.start();
  now = 10_000; await session.end();
  now = 100_000; await session.start();
  now = 105_000; await session.heartbeat();
  assert.equal(calls.filter(call => call.action === 'start').length, 1);
  assert.equal(calls.at(-1).durationMs, 15_000);
  assert.equal(calls.at(-1).sessionKey, 'session-1');
  await session.end();
  const count = calls.length;
  await session.heartbeat();
  await session.end();
  assert.equal(calls.length, count);
});

test('a view closed before its start response arrives is ended after the response', async () => {
  const calls = [];
  let resolve;
  const session = new VisibleViewSession({ request: async (action, payload) => {
    calls.push({ action, ...payload });
    if (action === 'start') return new Promise(done => { resolve = done; });
  } });
  const pending = session.start();
  await session.end();
  resolve({ sessionKey: 'late-key' });
  await pending;
  assert.equal(calls.at(-1).action, 'end');
  assert.equal(calls.at(-1).sessionKey, 'late-key');
});

test('failed view creation retries on the next visible heartbeat', async () => {
  let attempts = 0;
  const session = new VisibleViewSession({ request: async () => {
    if (++attempts === 1) throw new Error('Offline');
    return { sessionKey: 'retried' };
  } });
  await session.start();
  await session.heartbeat();
  assert.equal(session.current.key, 'retried');
});

test('step charts hold the previous value until the next bid', () => {
  const points = [{ time: 1, price: 10 }, { time: 2, price: 20 }, { time: 4, price: 25 }];
  assert.equal(stepPath(points, time => time, value => 100 - value, 'price'), 'M1,90 H2V80 H4V75');
});

test('sampled history begins at the original first bid and keeps complete final totals', () => {
  const history = [{ time: '2026-11-23T12:03:00Z', firstAt: '2026-11-23T12:00:00Z', price: 250, bids: 200, bidders: 40 }];
  const points = chartPoints(history, { startingBid: 25, now: new Date('2026-11-23T12:05:00Z') });
  assert.equal(points[0].time, '2026-11-23T11:59:59.000Z');
  assert.equal(points[0].price, 25);
  assert.equal(points[0].bidders, 0);
  assert.equal(points.at(-1).bids, 200);
  assert.equal(points.at(-1).bidders, 40);
  const finished = chartPoints(history, { finished: true });
  assert.equal(finished.at(-1).time, '2026-11-23T12:03:01.000Z');
  assert.deepEqual(chartPoints([]), []);
});

const group = (currency, status, amount, count = 1) => ({ currency, status, _sum: { totalAmount: amount }, _count: { _all: count } });
test('seller collections separate currencies, pending payments, refunds and cancellations', () => {
  const result = summarizeSellerMetrics({
    sales: { sold: 2, unsold: 1, totalLots: 10, hammerTotal: 300 },
    invoices: [group('usd', 'PAID', '330', 2), group('usd', 'UNPAID', '100'), group('usd', 'PENDING_CHECKOUT', '50'), group('usd', 'AWAITING_EXTERNAL', '20'), group('usd', 'REFUNDED', '999'), group('usd', 'CANCELLED', '888'), group('eur', 'PAID', '200')]
  });
  assert.equal(result.sales.averageHammer, 150);
  assert.equal(result.sales.sellThrough, 2 / 3 * 100);
  const usd = result.collections.find(row => row.currency === 'USD');
  assert.equal(usd.received, 330);
  assert.equal(usd.averagePayment, 165);
  assert.equal(usd.outstanding, 170);
  assert.equal(usd.unpaidInvoices, 3);
  assert.equal(result.collections.find(row => row.currency === 'EUR').received, 200);
});

test('zero sales have unavailable averages, while a valid zero-dollar sale averages zero', () => {
  const empty = summarizeSellerMetrics({ sales: { sold: 0, unsold: 0, hammerTotal: 0 } });
  assert.equal(empty.sales.averageHammer, null);
  assert.equal(empty.sales.sellThrough, null);
  assert.equal(summarizeSellerMetrics({ sales: { sold: 1, hammerTotal: 0 } }).sales.averageHammer, 0);
});

test('non-finance summaries omit financial totals and payment method details', () => {
  const result = summarizeSellerMetrics({ canViewFinance: false, sales: { sold: 2, hammerTotal: 999 }, invoices: [group('usd', 'PAID', 999)], methods: [group('usd', 'PAID', 999)] });
  assert.equal(result.sales.hammerTotal, undefined);
  assert.equal(result.sales.averageHammer, undefined);
  assert.deepEqual(result.collections, []);
  assert.deepEqual(result.methods, []);
});
