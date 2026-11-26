import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const state = globalThis.__auctionRelistTest = {};
const now = new Date('2026-11-23T12:00:00Z');
function matches(lot, where) {
  if (where.auctionId && lot.auctionId !== where.auctionId) return false;
  if (where.id?.in && !where.id.in.includes(lot.id)) return false;
  if (where.status && lot.status !== where.status) return false;
  if (where.isReady !== undefined && lot.isReady !== where.isReady) return false;
  if (where.endTime?.gt && !(lot.endTime > where.endTime.gt)) return false;
  if (where.highestBidderId === null && lot.highestBidderId) return false;
  if (where.invoice && lot.invoice) return false;
  if (where.bids && lot.bids.length) return false;
  return true;
}
const tx = {
  $queryRaw: async () => { state.locks++; return [{ id: 'auction' }]; },
  auction: {
    findUnique: async () => state.auction ? structuredClone(state.auction) : null,
    update: async ({ data }) => { Object.assign(state.auction, data); return structuredClone(state.auction); }
  },
  lot: {
    findFirst: async ({ where }) => structuredClone(state.lots.find(lot => matches(lot, where)) || null),
    findMany: async ({ where }) => structuredClone(state.lots.filter(lot => matches(lot, where)).sort((a, b) => a.position - b.position)),
    count: async ({ where }) => state.lots.filter(lot => matches(lot, where)).length,
    updateMany: async ({ where, data }) => { const lots = state.lots.filter(lot => matches(lot, where)); lots.forEach(lot => Object.assign(lot, data)); return { count: lots.length }; },
    update: async ({ where, data }) => { const lot = state.lots.find(lot => lot.id === where.id); Object.assign(lot, data); return structuredClone(lot); }
  }
};
state.client = { $transaction: async callback => {
  const previous = state.queue;
  let done;
  state.queue = new Promise(resolve => { done = resolve; });
  await previous;
  const snapshot = structuredClone({ auction: state.auction, lots: state.lots });
  try { return await callback(tx); }
  catch (err) { state.auction = snapshot.auction; state.lots = snapshot.lots; throw err; }
  finally { done(); }
} };
state.client.auctionHouse = {
  findUnique: async () => ({ id: 'house', settings: state.houseSettings }),
  update: async ({ data }) => { state.houseSettings = data.settings; return { id: 'house' }; }
};
tx.auctionHouse = state.client.auctionHouse;
state.auth = {
  HOUSE_PERMISSIONS: { VIEW: 'VIEW', MANAGE_COMPANY: 'MANAGE_COMPANY' },
  requireAuthenticatedUser: async () => {
    if (!state.user) throw Object.assign(new Error('Authentication required'), { status: 401 });
    return state.user;
  },
  requireAuctionHousePermission: async (user, id, permission) => {
    if (id !== 'house' || (permission === 'MANAGE_COMPANY' && !state.canManage)) throw Object.assign(new Error('Forbidden'), { status: 403 });
    return { role: 'OWNER' };
  }
};
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'relisting-test-adapters', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0prisma-relist';
    if (id === '$lib/server/authorization.js') return '\0auth-relist';
    if (id === '$lib/zod.js') return fileURLToPath(new URL('../src/lib/zod.ts', import.meta.url));
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0prisma-relist') return 'export default globalThis.__auctionRelistTest.client;';
    if (id === '\0auth-relist') return 'export const { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionHousePermission } = globalThis.__auctionRelistTest.auth;';
  }
}] });
const { finishOrRelistAuction, preserveRelistState } = await server.ssrLoadModule('/src/lib/server/auctionCompletion.js');
const { auctionHouseSettingsSchema } = await server.ssrLoadModule('/src/lib/zod.ts');
const houseRoute = await server.ssrLoadModule('/src/routes/api/auction-houses/[id]/settings/+server.js');
after(async () => { await server.close(); delete globalThis.__auctionRelistTest; });
const makeLot = (id, patch = {}) => ({ id, auctionId: 'auction', lotNumber: 10, position: 1, title: 'Original title', description: 'Catalog description', status: 'UNSOLD', isReady: true, highestBidderId: null, highestBidderName: null, currentBid: 0, startingBid: 25, bidIncrement: 5, endTime: new Date(now.getTime() - 1000), images: [{ url: 'original-image' }], bids: [], invoice: null, ...patch });
beforeEach(() => {
  state.queue = Promise.resolve(); state.locks = 0;
  state.user = { id: 'owner' }; state.canManage = true;
  state.houseSettings = JSON.stringify({ buyerPaysShipping: false, existingCustomKey: 'preserved' });
  state.auction = { id: 'auction', status: 'LIVE', startDate: new Date(now.getTime() - 3600000), endDate: now, auctioneerStartedAt: new Date(now.getTime() - 3600000), settings: JSON.stringify({ autoAdvanceNextLot: false }), auctionHouse: { settings: JSON.stringify({ relistUnsoldLotsAtEnd: true }) } };
  state.lots = [makeLot('unsold')];
});
const finish = options => finishOrRelistAuction({ auctionId: 'auction', now, ...options });

test('relisting is off by default and validates a true boolean', () => {
  assert.equal(auctionHouseSettingsSchema.parse({}).relistUnsoldLotsAtEnd, false);
  assert.equal(auctionHouseSettingsSchema.parse({ relistUnsoldLotsAtEnd: true }).relistUnsoldLotsAtEnd, true);
  assert.throws(() => auctionHouseSettingsSchema.parse({ relistUnsoldLotsAtEnd: 'true' }));
});
test('disabled setting finishes normally without resetting unsold lots', async () => {
  state.auction.auctionHouse.settings = '{}';
  const result = await finish();
  assert.equal(result.auctionEnded, true);
  assert.equal(result.relistedCount, 0);
  assert.equal(state.lots[0].status, 'UNSOLD');
});
test('eligible unsold lots rejoin the same auction and preserve their catalog and images', async () => {
  const original = structuredClone(state.lots[0]);
  const result = await finish();
  assert.equal(result.auctionEnded, false);
  assert.equal(result.relistedCount, 1);
  assert.equal(result.nextLot, null);
  assert.equal(state.auction.status, 'LIVE');
  assert.ok(state.auction.endDate > now);
  assert.equal(state.lots[0].status, 'ACTIVE');
  assert.equal(state.lots[0].endTime, null);
  for (const field of ['id', 'auctionId', 'lotNumber', 'position', 'startingBid', 'bidIncrement', 'title', 'description', 'images']) assert.deepEqual(state.lots[0][field], original[field]);
  assert.equal(JSON.parse(state.auction.settings).unsoldRelistRoundStartedAt, now.toISOString());
});
test('sold, withdrawn, unready, invoiced, bid-on and other-auction lots are not relisted', async () => {
  state.lots.push(makeLot('sold', { status: 'SOLD' }), makeLot('withdrawn', { status: 'WITHDRAWN' }), makeLot('unready', { isReady: false }), makeLot('invoice', { invoice: { id: 'invoice' } }), makeLot('bid', { bids: [{ id: 'bid' }] }), makeLot('winner', { highestBidderId: 'buyer' }), makeLot('other', { auctionId: 'another-auction' }));
  const result = await finish();
  assert.equal(result.relistedCount, 1);
  assert.equal(state.lots.filter(lot => lot.status === 'ACTIVE').length, 1);
});
test('auto-advance opens the first relisted lot with inherited timing', async () => {
  state.auction.settings = JSON.stringify({ autoAdvanceNextLot: true });
  state.auction.auctionHouse.settings = JSON.stringify({ relistUnsoldLotsAtEnd: true, automaticAuctionInitialTimerSeconds: 90 });
  const result = await finish();
  assert.equal(result.nextLot.id, 'unsold');
  assert.equal(state.lots[0].endTime.getTime(), now.getTime() + 90000);
  assert.equal(JSON.parse(state.auction.settings).onBlockLotId, 'unsold');
});
test('unsold lots in the extra round are not relisted a second time', async () => {
  await finish();
  state.lots[0].status = 'UNSOLD';
  const result = await finish();
  assert.equal(result.auctionEnded, true);
  assert.equal(result.relistedCount, 0);
});
test('concurrent completion requests create only one extra round', async () => {
  const results = await Promise.all([finish(), finish()]);
  assert.equal(results.reduce((sum, result) => sum + result.relistedCount, 0), 1);
  assert.equal(state.auction.status, 'LIVE');
  assert.equal(state.locks, 2);
});
test('manual ending marks queued lots unsold and moves them into the one extra round', async () => {
  state.lots[0].status = 'ACTIVE'; state.lots[0].endTime = null;
  const result = await finish({ markRemainingUnsold: true });
  assert.equal(result.relistedCount, 1);
  assert.equal(state.lots[0].status, 'ACTIVE');
});
test('an open lot prevents manual ending and rolls back changes', async () => {
  state.lots.push(makeLot('open', { status: 'ACTIVE', endTime: new Date(now.getTime() + 60000) }));
  await assert.rejects(finish({ markRemainingUnsold: true }), err => err.status === 409);
  assert.equal(state.lots[0].status, 'UNSOLD');
  assert.equal(JSON.parse(state.auction.settings).unsoldRelistRoundStartedAt, undefined);
});
test('scheduled completion extends the original auction window only once', async () => {
  state.auction.auctioneerStartedAt = null;
  const result = await finish({ scheduled: true });
  assert.equal(result.relistedCount, 1);
  assert.equal(state.auction.endDate.getTime(), now.getTime() + 3600000);
  const next = await finish({ scheduled: true });
  assert.equal(next.skipped, true);
  const ended = await finish({ scheduled: true, now: new Date(now.getTime() + 3600000) });
  assert.equal(ended.auctionEnded, true);
  assert.equal(ended.relistedCount, 0);
});
test('a scheduled worker cannot finish an auction whose floor has already started', async () => {
  const result = await finish({ scheduled: true });
  assert.equal(result.skipped, true);
  assert.equal(state.auction.status, 'LIVE');
});
test('ordinary settings saves preserve runtime state and cannot forge or clear it', () => {
  const original = { unsoldRelistRoundStartedAt: now.toISOString(), unsoldRelistCount: 4 };
  assert.deepEqual(preserveRelistState(original, { autoAdvanceNextLot: true, unsoldRelistRoundStartedAt: null }), { ...original, autoAdvanceNextLot: true });
  assert.deepEqual(preserveRelistState({}, { unsoldRelistRoundStartedAt: now.toISOString(), unsoldRelistCount: 100 }), {});
});

const save = body => houseRoute.PATCH({ params: { id: 'house' }, locals: {}, request: new Request('https://pumbi.test/api/auction-houses/house/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
test('house toggle persists and preserves unrelated settings, including blank optional emails', async () => {
  const response = await save({ relistUnsoldLotsAtEnd: true, email: '', emailToNotifyBidsUpdate: '' });
  assert.equal(response.status, 200);
  const stored = JSON.parse(state.houseSettings);
  assert.equal(stored.relistUnsoldLotsAtEnd, true);
  assert.equal(stored.buyerPaysShipping, false);
  assert.equal(stored.existingCustomKey, 'preserved');
  const read = await houseRoute.GET({ params: { id: 'house' }, locals: {} });
  assert.equal((await read.json()).relistUnsoldLotsAtEnd, true);
});
test('only authenticated house managers can change relisting policy', async () => {
  state.canManage = false;
  await assert.rejects(save({ relistUnsoldLotsAtEnd: true }), err => err.status === 403);
  assert.equal(JSON.parse(state.houseSettings).relistUnsoldLotsAtEnd, undefined);
  state.user = null;
  await assert.rejects(save({ relistUnsoldLotsAtEnd: true }), err => err.status === 401);
});
