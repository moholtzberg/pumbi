import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const state = globalThis.__phoneBidTest = {};
const denied = status => { const err = new Error('Denied'); err.status = status; throw err; };
const client = {
  $queryRaw: async (strings, ...values) => { state.locks.push({ text: String(strings), values }); return []; },
  auction: {
    findUnique: async ({ where }) => where.id === state.auction.id ? structuredClone(state.auction) : null,
    update: async ({ data }) => { Object.assign(state.auction, data); return structuredClone(state.auction); }
  },
  lot: {
    findFirst: async ({ where }) => where.id === state.lot.id && (!where.auctionId || where.auctionId === state.auction.id) ? { ...structuredClone(state.lot), auction: structuredClone(state.auction) } : null,
    findUnique: async ({ where, select }) => where.id === state.lot.id ? select?.auctionId ? { auctionId: state.auction.id } : { ...structuredClone(state.lot), auction: structuredClone(state.auction) } : null,
    update: async ({ data }) => { Object.assign(state.lot, data); return structuredClone(state.lot); },
    updateMany: async ({ where, data }) => {
      if (where.currentBid !== state.lot.currentBid || where.highestBidderId !== state.lot.highestBidderId) return { count: 0 };
      Object.assign(state.lot, data); return { count: 1 };
    },
    count: async () => state.lot.status === 'ACTIVE' ? 1 : 0
  },
  user: {
    findFirst: async ({ where }) => structuredClone(state.users.find(user => user.email.toLowerCase() === where.email.equals.toLowerCase()) || null),
    create: async ({ data }) => {
      state.createdUserData = data;
      const user = { id: 'new-buyer', isVerifiedBuyer: false, isVerifiedBidder: false, ...data };
      state.users.push(user); return structuredClone(user);
    }
  },
  auctionRegistration: {
    findUnique: async ({ where, include }) => {
      const row = state.registrations.find(row => row.auctionId === where.auctionId_userId.auctionId && row.userId === where.auctionId_userId.userId);
      return row ? { ...structuredClone(row), ...(include?.user ? { user: structuredClone(state.users.find(user => user.id === row.userId)) } : {}) } : null;
    },
    findMany: async args => { state.searchArgs = args; return state.registrations.filter(row => row.status === 'APPROVED' && row.auctionId === args.where.auctionId).map(row => ({ user: state.users.find(user => user.id === row.userId) })); },
    upsert: async ({ where, create, update }) => {
      const row = state.registrations.find(row => row.userId === where.auctionId_userId.userId);
      if (row) Object.assign(row, update); else state.registrations.push(create);
    }
  },
  bid: { create: async ({ data }) => { const bid = { id: `bid-${state.bids.length + 1}`, timestamp: new Date(), source: 'ONLINE', recordedById: null, ...data }; state.bids.push(bid); return structuredClone(bid); } }
};
client.$transaction = async callback => {
  const previous = state.queue;
  let release; state.queue = new Promise(resolve => { release = resolve; });
  await previous;
  const snapshot = structuredClone({ auction: state.auction, lot: state.lot, users: state.users, registrations: state.registrations, bids: state.bids });
  try { return await callback(client); } catch (err) { Object.assign(state, snapshot); throw err; } finally { release(); }
};
state.client = client;
state.auth = {
  HOUSE_PERMISSIONS: { MANAGE_AUCTIONS: 'MANAGE_AUCTIONS', MANAGE_BIDDERS: 'MANAGE_BIDDERS' },
  requireAuthenticatedUser: async locals => locals.user || state.actor || denied(401),
  requireAuctionAccess: (user, auction) => { if (!auction) denied(404); if (user.house !== auction.auctionHouseId) denied(403); },
  requireAuctionHousePermission: async () => { if (!state.canManage) denied(403); }
};
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'phone-bid-fixtures', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0phone-prisma';
    if (id === '$lib/db.js') return '\0phone-db';
    if (id === '$lib/server/authorization.js') return '\0phone-auth';
    if (id === '$lib/server/invoices.js') return '\0phone-invoices';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0phone-prisma') return 'export default globalThis.__phoneBidTest.client;';
    if (id === '\0phone-db') return 'export const db = {};';
    if (id === '\0phone-auth') return 'export const { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission } = globalThis.__phoneBidTest.auth;';
    if (id === '\0phone-invoices') return 'export async function createInvoiceForSoldLot() { const s=globalThis.__phoneBidTest; s.invoiceBuyer=s.lot.highestBidderId; return {id:"invoice"}; }';
  }
}] });
const phone = await server.ssrLoadModule('/src/routes/api/auctions/[id]/phone-bids/+server.js');
const online = await server.ssrLoadModule('/src/routes/api/bids/+server.js');
const live = await server.ssrLoadModule('/src/routes/api/auctions/[id]/live/+server.js');
const rules = await server.ssrLoadModule('/src/lib/server/bidRules.js');
after(async () => { await server.close(); delete globalThis.__phoneBidTest; });
beforeEach(() => {
  state.actor = { id: 'auctioneer', house: 'house' }; state.canManage = true; state.queue = Promise.resolve();
  state.auction = { id: 'auction', auctionHouseId: 'house', auctioneerId: 'auctioneer', sellerId: 'seller', status: 'LIVE', type: 'PRIVATE', auctioneerStartedAt: new Date(), settings: JSON.stringify({ onBlockLotId: 'lot' }), startDate: new Date(Date.now() - 100000), endDate: new Date(Date.now() + 3600000), auctionHouse: { settings: JSON.stringify({ automaticAuctionTimerResetSeconds: 60 }) } };
  state.lot = { id: 'lot', auctionId: 'auction', ownerUserId: 'owner', status: 'ACTIVE', isReady: true, lotNumber: 1, currentBid: 100, startingBid: 50, bidIncrement: 10, highestBidderId: 'old-buyer', highestBidderName: 'Old bidder', endTime: new Date(Date.now() + 10000) };
  state.users = [{ id: 'buyer', name: 'Alice', email: 'alice@example.com', isVerifiedBuyer: true }, { id: 'buyer-2', name: 'Bob', email: 'bob@example.com', isVerifiedBuyer: true }];
  state.registrations = state.users.map(user => ({ auctionId: 'auction', userId: user.id, status: 'APPROVED' }));
  state.bids = []; state.locks = []; state.createdUserData = null; state.invoiceBuyer = null;
});
const payload = patch => ({ lotId: 'lot', mode: 'existing', bidderId: 'buyer', amount: 110, callerConfirmed: true, ...patch });
const event = (body = {}, locals = {}) => ({ params: { id: 'auction' }, locals, url: new URL('https://pumbi.test/api/auctions/auction/phone-bids'), request: new Request('https://pumbi.test/api/auctions/auction/phone-bids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });

test('auctioneer records a phone bid for an existing approved buyer with timer extension and attribution', async () => {
  const before = Date.now();
  const response = await phone.POST(event(payload()));
  assert.equal(response.status, 201);
  assert.equal(state.lot.highestBidderId, 'buyer');
  assert.equal(state.lot.currentBid, 110);
  assert.equal(state.bids[0].source, 'PHONE');
  assert.equal(state.bids[0].recordedById, 'auctioneer');
  assert.ok(state.lot.endTime.getTime() >= before + 60000);
  assert.ok(String(state.locks[0].text).includes('auctions'));
  assert.ok(String(state.locks[1].text).includes('lots'));
});

test('new callers get a buyer and registration without receiving online verification privileges', async () => {
  const response = await phone.POST(event(payload({ mode: 'new', caller: { name: 'New Caller', email: 'NEW@example.com', phone: '+1 212 555 0100' } })));
  assert.equal((await response.json()).newBuyer, true);
  assert.equal(state.createdUserData.email, 'new@example.com');
  assert.equal(state.createdUserData.password, null);
  assert.equal(state.createdUserData.isVerifiedBuyer, undefined);
  assert.equal(state.createdUserData.emailVerifiedAt, undefined);
  assert.equal(state.lot.highestBidderId, 'new-buyer');
  assert.equal(state.registrations.at(-1).reviewedById, 'auctioneer');
});

test('a matching existing email is reused without overwriting contact information', async () => {
  const response = await phone.POST(event(payload({ mode: 'new', caller: { name: 'Different Name', email: 'ALICE@example.com', phone: '2125550101' } })));
  assert.equal((await response.json()).newBuyer, false);
  assert.equal(state.users.length, 2);
  assert.equal(state.users[0].name, 'Alice');
  assert.equal(state.bids[0].userName, 'Alice');
});

test('anonymous users, other houses, non-managers and non-assigned auctioneers cannot record phone bids', async () => {
  state.actor = null;
  await assert.rejects(phone.POST(event(payload())), err => err.status === 401);
  state.actor = { id: 'auctioneer', house: 'other' };
  await assert.rejects(phone.POST(event(payload())), err => err.status === 403);
  state.actor.house = 'house'; state.canManage = false;
  await assert.rejects(phone.POST(event(payload())), err => err.status === 403);
  state.canManage = true; state.actor.id = 'other-auctioneer';
  await assert.rejects(phone.POST(event(payload())), err => err.status === 403);
  assert.equal(state.bids.length, 0);
});

test('expired, closed and queued lots cannot receive phone bids or create orphan callers', async () => {
  for (const change of [{ endTime: new Date(Date.now() - 1) }, { status: 'SOLD' }, { endTime: null }]) {
    const original = structuredClone(state.lot); Object.assign(state.lot, change);
    await assert.rejects(phone.POST(event(payload({ mode: 'new', caller: { name: 'No Create', email: 'nobody@example.com', phone: '2125550101' } }))), err => err.status === 409);
    state.lot = original;
  }
  assert.equal(state.createdUserData, null);
});

test('consent, caller details, approval and minimum bid are validated', async () => {
  for (const patch of [{ callerConfirmed: false }, { amount: 105 }, { amount: 110.001 }, { mode: 'new', caller: { name: 'Name', email: 'invalid', phone: '123' } }]) await assert.rejects(phone.POST(event(payload(patch))), err => err.status === 400);
  state.registrations[0].status = 'REJECTED';
  await assert.rejects(phone.POST(event(payload())), err => err.status === 403);
  await assert.rejects(phone.POST(event(payload({ mode: 'new', caller: { name: 'Alice', email: 'alice@example.com', phone: '2125550100' } }))), err => err.status === 403);
  assert.equal(state.bids.length, 0);
});

test('the seller, lot owner, auctioneer and current highest bidder are not eligible callers', async () => {
  for (const id of ['seller', 'owner', 'auctioneer', 'old-buyer']) {
    state.users[0].id = id; state.registrations[0].userId = id;
    await assert.rejects(phone.POST(event(payload({ bidderId: id }))), err => [400,403].includes(err.status));
  }
  assert.equal(state.bids.length, 0);
});

test('public caller consent records the current auction policy snapshot', async () => {
  Object.assign(state.auction, { type: 'PUBLIC', platformPolicyId: 'policy', policyVersionSnapshot: 3, buyerTermsSnapshot: 'Current terms' });
  await phone.POST(event(payload({ acceptedTerms: 'Current terms' })));
  assert.equal(state.registrations[0].acceptedPolicyId, 'policy');
  assert.equal(state.registrations[0].acceptedPolicyVersion, 3);
  assert.equal(state.registrations[0].acceptedBuyerTermsSnapshot, 'Current terms');
});

test('changed terms cannot be silently accepted using an older phone-bid form', async () => {
  state.auction.privateHouseBuyerTermsSnapshot = 'Updated terms';
  await assert.rejects(phone.POST(event(payload({ acceptedTerms: 'Old terms' }))), err => err.status === 409);
  assert.equal(state.bids.length, 0);
});

test('approved phone callers can remain unverified online', async () => {
  state.users[0].isVerifiedBuyer = false;
  await phone.POST(event(payload()));
  assert.equal(state.users[0].isVerifiedBuyer, false);
});

test('simultaneous phone and online bids at the same amount accept only one bid', async () => {
  const results = await Promise.allSettled([
    phone.POST(event(payload())),
    online.POST(event({ lotId: 'lot', amount: 110, source: 'PHONE' }, { user: state.users[1] }))
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(state.bids.length, 1);
  assert.equal(state.lot.highestBidderId, state.bids[0].userId);
  assert.ok(state.locks.length >= 4);
});

test('online callers cannot spoof a phone-bid source or recording auctioneer', async () => {
  await online.POST(event({ lotId: 'lot', amount: 110, source: 'PHONE', recordedById: 'auctioneer' }, { user: state.users[1] }));
  assert.equal(state.bids[0].source, 'ONLINE');
  assert.equal(state.bids[0].recordedById, null);
});

test('a phone winner is hammered sold and invoiced to the caller', async () => {
  await phone.POST(event(payload()));
  const response = await live.POST(event({ action: 'close', lotId: 'lot' }));
  assert.equal(response.status, 200);
  assert.equal(state.lot.status, 'SOLD');
  assert.equal(state.invoiceBuyer, 'buyer');
  assert.equal(state.lot.currentBid, 110);
});

test('hammering rechecks the winner after a bid arrives between initial read and close', async () => {
  const original = client.$transaction;
  let injected = false;
  client.$transaction = callback => {
    if (!injected) { injected = true; Object.assign(state.lot, { highestBidderId: 'buyer', highestBidderName: 'Alice', currentBid: 110 }); }
    return original(callback);
  };
  try { await live.POST(event({ action: 'close', lotId: 'lot' })); }
  finally { client.$transaction = original; }
  assert.equal(state.invoiceBuyer, 'buyer');
  assert.equal(state.lot.status, 'SOLD');
});

test('a failed bid rolls back a newly created caller, registration and price change', async () => {
  const original = client.bid.create;
  client.bid.create = async () => { throw Object.assign(new Error('Conflict'), { code: 'P2002' }); };
  try {
    await assert.rejects(phone.POST(event(payload({ mode: 'new', caller: { name: 'Rollback', email: 'rollback@example.com', phone: '2125550100' } }))), err => err.status === 409);
  } finally { client.bid.create = original; }
  assert.equal(state.users.length, 2);
  assert.equal(state.registrations.length, 2);
  assert.equal(state.lot.currentBid, 100);
  assert.equal(state.bids.length, 0);
});

test('online bids are also blocked on queued lots that have not been opened', async () => {
  state.lot.endTime = null;
  await assert.rejects(online.POST(event({ lotId: 'lot', amount: 110 }, { user: state.users[1] })), err => err.status === 409);
  assert.equal(state.bids.length, 0);
});

test('bidder lookup is restricted to the assigned auction and approved registrations', async () => {
  const response = await phone.GET(event());
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(state.searchArgs.where.auctionId, 'auction');
  assert.equal(state.searchArgs.where.status, 'APPROVED');
  assert.equal((await response.json()).bidders.length, 2);
});

test('currency minimums handle decimal increments without floating point drift', () => {
  assert.equal(rules.minimumLotBid({ startingBid: 0, currentBid: 0.1, bidIncrement: 0.2 }), 0.3);
  assert.equal(rules.bidAmount('110.50'), 110.5);
  assert.throws(() => rules.bidAmount(true), err => err.status === 400);
});
