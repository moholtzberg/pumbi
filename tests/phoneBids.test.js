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
  bidderBlock: {
    findUnique: async ({ where }) => structuredClone(state.blocks.find(row => row.auctionHouseId === where.auctionHouseId_userId.auctionHouseId && row.userId === where.auctionHouseId_userId.userId) || null),
    findMany: async ({ where }) => structuredClone(state.blocks.filter(row => row.auctionHouseId === where.auctionHouseId && row.active && where.userId.in.includes(row.userId)))
  },
  proxyBid: {
    findUnique: async ({ where }) => structuredClone(state.proxies.find(row => row.lotId === where.lotId_userId.lotId && row.userId === where.lotId_userId.userId) || null),
    findMany: async () => state.proxies.map(row => ({ ...structuredClone(row), user: structuredClone(state.users.find(user => user.id === row.userId)) })),
    upsert: async ({ where, create, update }) => {
      const row = state.proxies.find(row => row.lotId === where.lotId_userId.lotId && row.userId === where.lotId_userId.userId);
      if (row) Object.assign(row, update); else state.proxies.push({ id: 'proxy-' + state.proxies.length, ...create });
    }
  },
  auctionRegistration: {
    findUnique: async ({ where, include }) => {
      const row = state.registrations.find(row => row.auctionId === where.auctionId_userId.auctionId && row.userId === where.auctionId_userId.userId);
      return row ? { ...structuredClone(row), ...(include?.user ? { user: structuredClone(state.users.find(user => user.id === row.userId)) } : {}) } : null;
    },
    findMany: async args => { if (args.where.userId?.in) return state.registrations.filter(row => args.where.userId.in.includes(row.userId)); state.searchArgs = args; return state.registrations.filter(row => row.status === 'APPROVED' && row.auctionId === args.where.auctionId).map(row => ({ user: state.users.find(user => user.id === row.userId) })); },
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
  const snapshot = structuredClone({ auction: state.auction, lot: state.lot, users: state.users, registrations: state.registrations, bids: state.bids, proxies: state.proxies, blocks: state.blocks });
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
    if (id === '$lib/zod.js') return fileURLToPath(new URL('../src/lib/zod.ts', import.meta.url));
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
const registrationRoute = await server.ssrLoadModule('/src/routes/api/auctions/[id]/register/+server.js');
const rules = await server.ssrLoadModule('/src/lib/server/bidRules.js');
const proxyEngine = await server.ssrLoadModule('/src/lib/server/proxyBidding.js');
after(async () => { await server.close(); delete globalThis.__phoneBidTest; });
beforeEach(() => {
  state.actor = { id: 'auctioneer', house: 'house' }; state.canManage = true; state.queue = Promise.resolve();
  state.auction = { id: 'auction', auctionHouseId: 'house', auctioneerId: 'auctioneer', sellerId: 'seller', status: 'LIVE', type: 'PRIVATE', auctioneerStartedAt: new Date(), settings: JSON.stringify({ onBlockLotId: 'lot', requireRegistrationToBid: true }), startDate: new Date(Date.now() - 100000), endDate: new Date(Date.now() + 3600000), auctionHouse: { settings: JSON.stringify({ automaticAuctionTimerResetSeconds: 60 }) } };
  state.lot = { id: 'lot', auctionId: 'auction', ownerUserId: 'owner', status: 'ACTIVE', isReady: true, lotNumber: 1, currentBid: 100, startingBid: 50, bidIncrement: 10, highestBidderId: 'old-buyer', highestBidderName: 'Old bidder', endTime: new Date(Date.now() + 10000) };
  state.users = [{ id: 'buyer', name: 'Alice', email: 'alice@example.com', isVerifiedBuyer: true }, { id: 'buyer-2', name: 'Bob', email: 'bob@example.com', isVerifiedBuyer: true }];
  state.registrations = state.users.map(user => ({ auctionId: 'auction', userId: user.id, status: 'APPROVED' }));
  state.blocks = []; state.proxies = []; state.bids = []; state.locks = []; state.createdUserData = null; state.invoiceBuyer = null;
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

test('the seller, lot owner and auctioneer are not eligible callers', async () => {
  for (const id of ['seller', 'owner', 'auctioneer']) {
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
  await live.POST(event({ action: 'fair_warning', lotId: 'lot' }));
  const response = await live.POST(event({ action: 'close', lotId: 'lot', fairWarningKey: state.lot.fairWarningKey }));
  assert.equal(response.status, 200);
  assert.equal(state.lot.status, 'SOLD');
  assert.equal(state.invoiceBuyer, 'buyer');
  assert.equal(state.lot.currentBid, 110);
});

test('hammering rejects a stale warning when a bid arrives before the close lock', async () => {
  await live.POST(event({ action: 'fair_warning', lotId: 'lot' }));
  const oldKey = state.lot.fairWarningKey;
  const original = client.$transaction;
  let injected = false;
  client.$transaction = callback => {
    if (!injected) { injected = true; Object.assign(state.lot, { highestBidderId: 'buyer', highestBidderName: 'Alice', currentBid: 110, fairWarningAt: null, fairWarningKey: null }); }
    return original(callback);
  };
  try { await assert.rejects(live.POST(event({ action: 'close', lotId: 'lot', fairWarningKey: oldKey })), err => err.status === 409); }
  finally { client.$transaction = original; }
  assert.equal(state.invoiceBuyer, null);
  await live.POST(event({ action: 'fair_warning', lotId: 'lot' }));
  await live.POST(event({ action: 'close', lotId: 'lot', fairWarningKey: state.lot.fairWarningKey }));
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

const maximum = async (user, amount) => (await online.POST(event({ lotId: 'lot', amount }, { user }))).json();
const opening = () => Object.assign(state.lot, { startingBid: 25, currentBid: 0, bidIncrement: 5, highestBidderId: null, highestBidderName: null });

test('a $100 maximum over a $25 legacy bid advances only to $30', async () => {
  Object.assign(state.lot, { startingBid: 25, currentBid: 25, bidIncrement: 5 });
  const result = await maximum(state.users[0], 100);
  assert.equal(result.currentBid, 30); assert.equal(result.maximumBid, 100); assert.equal(result.isLeading, true);
  assert.equal(state.lot.currentBid, 30); assert.equal(state.bids.length, 1); assert.equal(state.bids[0].amount, 30);
  assert.equal(state.proxies[0].maxAmount, 100);
  assert.ok(!JSON.stringify(state.bids).includes('maxAmount'));
});

test('a higher incumbent maximum automatically outbids the incoming offer by one increment', async () => {
  opening();
  await maximum(state.users[0], 150);
  const result = await maximum(state.users[1], 100);
  assert.equal(result.currentBid, 105); assert.equal(result.isLeading, false); assert.equal(result.maximumBid, 100);
  assert.equal(state.lot.highestBidderId, 'buyer');
  assert.equal(state.bids.at(-1).isAutomatic, true); assert.equal(state.bids.at(-1).userId, 'buyer');
  assert.equal(state.bids.at(-2).amount, 100);
  assert.ok(!JSON.stringify(result).includes('150'));
});

test('a new higher maximum wins only one increment over the old maximum', async () => {
  opening();
  await maximum(state.users[0], 100);
  const result = await maximum(state.users[1], 150);
  assert.equal(result.currentBid, 105); assert.equal(result.isLeading, true);
  assert.equal(state.lot.highestBidderId, 'buyer-2');
});

test('equal maximums favor the earlier bidder and never exceed the winning cap', async () => {
  opening();
  await maximum(state.users[0], 100);
  const result = await maximum(state.users[1], 100);
  assert.equal(result.currentBid, 100); assert.equal(state.lot.highestBidderId, 'buyer');
  assert.equal(result.isLeading, false);
});

test('increasing a leading maximum changes no public price, history, timer or fair warning', async () => {
  opening();
  await maximum(state.users[0], 100); await maximum(state.users[1], 100);
  await live.POST(event({ action: 'fair_warning', lotId: 'lot' }));
  const before = structuredClone(state.lot), count = state.bids.length;
  const result = await maximum(state.users[0], 200);
  assert.equal(result.maxUpdatedOnly, true); assert.equal(result.currentBid, 100);
  assert.equal(state.bids.length, count); assert.deepEqual(state.lot, before);
  await assert.rejects(maximum(state.users[0], 150), err => err.status === 400);
});

test('maximums accept cents and resolve below a full increment when the winner cap binds', async () => {
  opening();
  await maximum(state.users[0], 32.5);
  const result = await maximum(state.users[1], 32.25);
  assert.equal(result.currentBid, 32.5); assert.equal(result.isLeading, false);
});

test('a competitive proxy bid clears fair warning and rejects the old hammer reference', async () => {
  opening(); await maximum(state.users[0], 150);
  await live.POST(event({ action: 'fair_warning', lotId: 'lot' }));
  const key = state.lot.fairWarningKey;
  await maximum(state.users[1], 100);
  assert.equal(state.lot.fairWarningAt, null); assert.equal(state.lot.fairWarningKey, null);
  await assert.rejects(live.POST(event({ action: 'close', lotId: 'lot', fairWarningKey: key })), err => err.status === 409);
  assert.equal(state.lot.status, 'ACTIVE');
});

test('hammering requires fair warning and queued lots cannot be warned or closed', async () => {
  await assert.rejects(live.POST(event({ action: 'close', lotId: 'lot' })), err => err.status === 409);
  state.lot.endTime = null;
  await assert.rejects(live.POST(event({ action: 'fair_warning', lotId: 'lot' })), err => err.status === 409);
});

test('fair warning revives an expired lot for at least ten seconds; repeated warnings are idempotent', async () => {
  state.lot.endTime = new Date(Date.now() - 1000);
  await live.POST(event({ action: 'fair_warning', lotId: 'lot' }));
  const warning = state.lot.fairWarningKey, end = state.lot.endTime.getTime();
  assert.ok(end >= Date.now() + 9900);
  await live.POST(event({ action: 'fair_warning', lotId: 'lot' }));
  assert.equal(state.lot.fairWarningKey, warning); assert.equal(state.lot.endTime.getTime(), end);
});

test('phone maximums share the proxy engine and preserve automatic phone attribution', async () => {
  opening();
  const first = await (await phone.POST(event(payload({ amount: 150 })))).json();
  assert.equal(first.currentBid, 25); assert.equal(first.maximumBid, 150);
  await maximum(state.users[1], 100);
  assert.equal(state.lot.currentBid, 105);
  assert.equal(state.bids.at(-1).source, 'PHONE'); assert.equal(state.bids.at(-1).recordedById, 'auctioneer');
  assert.equal(state.bids.at(-1).isAutomatic, true);
});

test('maximum lookup returns only the authenticated bidder ceiling and is not cacheable', async () => {
  opening(); await maximum(state.users[0], 150);
  const request = event({}, { user: state.users[1] });
  request.url = new URL('https://pumbi.test/api/bids?view=maximum&lotId=lot&userId=buyer');
  const response = await online.GET(request);
  assert.equal((await response.json()).maximumBid, null);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  request.locals.user = state.users[0];
  assert.equal((await (await online.GET(request)).json()).maximumBid, 150);
});

test('revoked proxy approval stops automatic defense while the existing public bid remains binding', async () => {
  opening(); await maximum(state.users[0], 150);
  state.registrations[0].status = 'REJECTED';
  const result = await maximum(state.users[1], 100);
  assert.equal(result.currentBid, 30); assert.equal(result.isLeading, true);
});

test('concurrent different maximums settle at the correct price with one final winner', async () => {
  opening();
  await Promise.all([maximum(state.users[0], 150), maximum(state.users[1], 100)]);
  assert.equal(state.lot.currentBid, 105); assert.equal(state.lot.highestBidderId, 'buyer');
});


test('effective bid timestamps use the post-lock acceptance clock', async () => {
  opening();
  const acceptedAt = new Date(Date.now() - 1000);
  await client.$transaction(tx => proxyEngine.submitMaximumBid(tx, { lot: { ...state.lot, auction: state.auction }, buyer: state.users[0], maximum: 100, now: acceptedAt }));
  assert.equal(state.bids[0].timestamp.getTime(), acceptedAt.getTime());
});

const registrationSetting = required => { state.auction.settings = JSON.stringify({ onBlockLotId: 'lot', ...(required === undefined ? {} : { requireRegistrationToBid: required }) }); };

test('signed-in unverified users can bid without registration when the auction setting is off', async () => {
  opening(); registrationSetting(false); state.registrations = []; state.users[0].isVerifiedBuyer = false;
  const result = await maximum(state.users[0], 100);
  assert.equal(result.currentBid, 25); assert.equal(result.isLeading, true);
  assert.equal(state.registrations.length, 0);
});

test('an absent registration setting follows the configured default of no registration', async () => {
  opening(); registrationSetting(undefined); state.registrations = []; state.users[0].isVerifiedBuyer = false;
  assert.equal((await maximum(state.users[0], 100)).isLeading, true);
});

test('automatic maximum bids remain active for unverified users on open auctions', async () => {
  opening(); registrationSetting(false); state.registrations = [];
  state.users.forEach(user => { user.isVerifiedBuyer = false; });
  await maximum(state.users[0], 100);
  const result = await maximum(state.users[1], 80);
  assert.equal(result.currentBid, 85); assert.equal(result.isLeading, false);
  assert.equal(state.lot.highestBidderId, state.users[0].id);
  assert.equal(state.bids.at(-1).isAutomatic, true);
});

test('public open auctions also allow logged-in bidding without a registration or terms step', async () => {
  opening(); registrationSetting(false); state.auction.type = 'PUBLIC'; state.registrations = []; state.users[0].isVerifiedBuyer = false;
  assert.equal((await maximum(state.users[0], 100)).currentBid, 25);
  const access = await (await registrationRoute.GET(event({}, { user: state.users[0] }))).json();
  assert.equal(access.readyToBid, true); assert.equal(access.registrationRequired, false);
  assert.equal(access.needsVerification, false); assert.equal(access.needsTermsAcceptance, false);
});

test('open-auction access ignores old pending/rejected approval states and creates no registration', async () => {
  registrationSetting(false); state.users[0].isVerifiedBuyer = false;
  for (const status of ['PENDING', 'REJECTED']) {
    state.registrations[0].status = status;
    const response = await registrationRoute.GET(event({}, { user: state.users[0] }));
    const access = await response.json();
    assert.equal(access.readyToBid, true); assert.equal(access.approvalRequired, false);
    assert.equal(access.needsVerification, false); assert.equal(access.needsTermsAcceptance, false);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
  }
  state.registrations = [];
  const result = await (await registrationRoute.POST(event({}, { user: state.users[0] }))).json();
  assert.equal(result.readyToBid, true); assert.equal(result.status, 'NOT_REQUIRED');
  assert.equal(state.registrations.length, 0);
});

test('registration-required auctions still enforce verification and approval', async () => {
  state.users[0].isVerifiedBuyer = false;
  await assert.rejects(maximum(state.users[0], 110), err => err.status === 403);
  state.users[0].isVerifiedBuyer = true; state.registrations[0].status = 'PENDING';
  await assert.rejects(maximum(state.users[0], 110), err => err.status === 403);
  const access = await (await registrationRoute.GET(event({}, { user: state.users[0] }))).json();
  assert.equal(access.registrationRequired, true); assert.equal(access.readyToBid, false);
  assert.equal(state.bids.length, 0);
});

test('registration-required public auctions still enforce the current policy snapshot', async () => {
  Object.assign(state.auction, { type: 'PUBLIC', platformPolicyId: 'policy', policyVersionSnapshot: 1, buyerTermsSnapshot: 'Terms' });
  await assert.rejects(maximum(state.users[0], 110), err => err.status === 403);
  Object.assign(state.registrations[0], { termsAcceptedAt: new Date(), acceptedPolicyId: 'policy', acceptedPolicyVersion: 1, acceptedBuyerTermsSnapshot: 'Terms' });
  assert.equal((await maximum(state.users[0], 110)).isLeading, true);
});

test('turning registration back on stops ineligible automatic defenses', async () => {
  opening(); registrationSetting(false); state.registrations = []; state.users[0].isVerifiedBuyer = false;
  await maximum(state.users[0], 100);
  registrationSetting(true);
  state.registrations.push({ auctionId: 'auction', userId: state.users[1].id, status: 'APPROVED' });
  const result = await maximum(state.users[1], 80);
  assert.equal(result.currentBid, 30); assert.equal(result.isLeading, true);
});

test('open bidding still requires sign-in and rejects closed lots and self-bidding', async () => {
  registrationSetting(false); state.actor = null;
  await assert.rejects(online.POST(event({ lotId: 'lot', amount: 110 })), err => err.status === 401);
  state.lot.ownerUserId = state.users[0].id;
  await assert.rejects(maximum(state.users[0], 110), err => err.status === 403);
  state.lot.ownerUserId = 'owner'; state.lot.endTime = new Date(Date.now() - 1000);
  await assert.rejects(maximum(state.users[0], 110), err => err.status === 409);
  assert.equal(state.bids.length, 0);
});


test('a house block stops incoming bids in open auctions and appears in access checks', async () => {
  opening(); registrationSetting(false); state.registrations = [];
  state.blocks = [{ auctionHouseId: 'house', userId: 'buyer', active: true, reason: 'Internal reason must stay private' }];
  await assert.rejects(maximum(state.users[0], 100), err => err.status === 403 && !err.body.message.includes('Internal reason'));
  const access = await (await registrationRoute.GET(event({}, { user: state.users[0] }))).json();
  assert.equal(access.blocked, true); assert.equal(access.readyToBid, false); assert.equal(access.needsTermsAcceptance, false);
  assert.ok(!JSON.stringify(access).includes('Internal reason'));
  await assert.rejects(registrationRoute.POST(event({}, { user: state.users[0] })), err => err.status === 403);
  assert.equal(state.bids.length, 0); assert.equal(state.proxies.length, 0);
});

test('house blocks stop phone bids and private maximum increases too', async () => {
  opening(); await maximum(state.users[0], 100);
  state.blocks = [{ auctionHouseId: 'house', userId: 'buyer', active: true }];
  await assert.rejects(phone.POST(event(payload({ amount: 150 }))), err => err.status === 403);
  await assert.rejects(maximum(state.users[0], 200), err => err.status === 403);
  assert.equal(state.proxies[0].maxAmount, 100); assert.equal(state.lot.currentBid, 25);
});

test('a blocked incumbent cannot automatically defend their maximum but their accepted bid remains', async () => {
  opening(); registrationSetting(false); await maximum(state.users[0], 150);
  state.blocks = [{ auctionHouseId: 'house', userId: 'buyer', active: true }];
  const result = await maximum(state.users[1], 100);
  assert.equal(result.currentBid, 30); assert.equal(result.isLeading, true);
  assert.equal(state.bids[0].amount, 25); assert.equal(state.bids[0].userId, 'buyer');
});

test('blocks from another house do not apply, and an inactive block restores ordinary access', async () => {
  opening(); registrationSetting(false);
  state.blocks = [{ auctionHouseId: 'foreign', userId: 'buyer', active: true }, { auctionHouseId: 'house', userId: 'buyer', active: false }];
  assert.equal((await maximum(state.users[0], 100)).isLeading, true);
});

test('house tiers apply to incoming online bids and automatic defenses at a competing maximum', async () => {
  state.auction.auctionHouse.settings=JSON.stringify({bidIncrements:[{from:0,increment:5},{from:1000,increment:100}]});
  opening();
  assert.equal((await maximum(state.users[0],2000)).currentBid,25);
  const defense=await maximum(state.users[1],1000);
  assert.equal(defense.currentBid,1100);assert.equal(defense.isLeading,false);
  await assert.rejects(maximum(state.users[1],1150),err=>err.status===400);
});

test('phone bids follow the same house tier instead of a lot fixed fallback', async () => {
  state.auction.auctionHouse.settings=JSON.stringify({bidIncrements:[{from:0,increment:5},{from:1000,increment:100}]});
  Object.assign(state.lot,{currentBid:1000,bidIncrement:5});
  await assert.rejects(phone.POST(event(payload({amount:1005}))),err=>err.status===400);
  const result=await (await phone.POST(event(payload({amount:1100})))).json();
  assert.equal(result.currentBid,1100);
});
