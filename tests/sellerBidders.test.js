import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const state = globalThis.__sellerBidderTest = {};
const deny = status => { const err = new Error('Denied'); err.status = status; throw err; };
state.auth = {
  HOUSE_PERMISSIONS: { MANAGE_BIDDERS: 'MANAGE_BIDDERS' },
  requireAuthenticatedUser: async locals => locals.user || deny(401),
  requireAuctionHousePermission: async (user, houseId) => user.houseId === houseId && ['OWNER','ADMIN','AUCTION_MANAGER'].includes(user.role) ? { role: user.role } : deny(403),
  requireAuctionHouseTeamManager: async (user, houseId) => user.houseId === houseId && ['OWNER','ADMIN'].includes(user.role) ? { role: user.role } : deny(403)
};
const client = {
  auctionHouse: { findUnique: async () => ({ id: 'house', name: 'House' }) },
  $queryRaw: async (query, ...values) => {
    const sql = typeof query.sql === 'string' ? query.sql : String(query);
    state.queries.push({ sql, values: query.values || values });
    if (sql.includes('FROM users u WHERE u.id=')) return state.associated ? [{ id: 'buyer', email: 'buyer@example.com' }] : [];
    return [];
  },
  bidderBlock: {
    upsert: async ({ create, update }) => { state.block = state.block ? { ...state.block, ...update } : create; },
    updateMany: async ({ where, data }) => { if (state.block?.auctionHouseId === where.auctionHouseId && state.block?.userId === where.userId) Object.assign(state.block, data); return { count: 1 }; }
  }
};
client.$transaction = async callback => callback(client);
state.client = client;
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'seller-bidder-fixtures', enforce: 'pre', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0bidder-prisma';
    if (id === './authorization.js') return '\0bidder-auth';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0bidder-prisma') return 'export default globalThis.__sellerBidderTest.client;';
    if (id === '\0bidder-auth') return 'export const { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionHousePermission, requireAuctionHouseTeamManager } = globalThis.__sellerBidderTest.auth;';
  }
}] });
const service = await server.ssrLoadModule('/src/lib/server/sellerBidders.js');
const profileApi = await server.ssrLoadModule('/src/routes/api/auction-houses/[id]/bidders/[bidderId]/+server.js');
after(async () => { await server.close(); delete globalThis.__sellerBidderTest; });
beforeEach(() => { state.queries = []; state.block = null; state.associated = true; });
const locals = role => ({ user: { id: 'owner', houseId: 'house', role } });

test('owners/admins can manage house profiles; auction managers only get the bidder directory', async () => {
  assert.equal((await service.requireBidderHouse(locals('OWNER'), 'house', { owner: true, client })).canViewProfiles, true);
  assert.equal((await service.requireBidderHouse(locals('ADMIN'), 'house', { owner: true, client })).canViewProfiles, true);
  assert.equal((await service.requireBidderHouse(locals('AUCTION_MANAGER'), 'house', { client })).canViewProfiles, false);
  await assert.rejects(profileApi.GET({ params: { id: 'house', bidderId: 'buyer' }, locals: locals('AUCTION_MANAGER'), url: new URL('https://pumbi.test') }), err => err.status === 403);
  await assert.rejects(service.requireBidderHouse({}, 'house', { owner: true, client }), err => err.status === 401);
  await assert.rejects(service.requireBidderHouse(locals('OWNER'), 'foreign', { owner: true, client }), err => err.status === 403);
  assert.equal(state.queries.length, 0);
});

test('block/unblock preserves the audit reason and uses the exclusive transaction guard', async () => {
  await service.setHouseBidderBlock(locals('OWNER'), 'house', 'buyer', { blocked: true, reason: ' Unpaid invoices ' }, client);
  assert.equal(state.block.reason, 'Unpaid invoices'); assert.equal(state.block.active, true); assert.equal(state.block.blockedById, 'owner');
  assert.ok(state.queries.some(row => row.sql.includes('pg_advisory_xact_lock(')));
  await service.setHouseBidderBlock(locals('OWNER'), 'house', 'buyer', { blocked: false }, client);
  assert.equal(state.block.active, false); assert.equal(state.block.reason, 'Unpaid invoices');
  assert.equal(state.block.unblockedById, 'owner'); assert.ok(state.block.unblockedAt instanceof Date);
});

test('block reasons and bidder-house association are required; unauthorized callers cannot block', async () => {
  await assert.rejects(service.setHouseBidderBlock(locals('OWNER'), 'house', 'buyer', { blocked: true, reason: '' }, client), err => err.status === 400);
  await assert.rejects(service.setHouseBidderBlock(locals('OWNER'), 'house', 'buyer', { blocked: 'true', reason: 'Reason' }, client), err => err.status === 400);
  await assert.rejects(service.setHouseBidderBlock(locals('AUCTION_MANAGER'), 'house', 'buyer', { blocked: true, reason: 'Reason' }, client), err => err.status === 403);
  state.associated = false;
  await assert.rejects(service.setHouseBidderBlock(locals('OWNER'), 'house', 'foreign-buyer', { blocked: true, reason: 'Reason' }, client), err => err.status === 404);
  assert.equal(state.block, null);
});

test('balances calculate exact cents, distinguish unpaid/refunded/cancelled, and separate currencies', () => {
  const group = (currency, status, amount, count = 1) => ({ currency, status, _sum: { totalAmount: amount }, _count: { _all: count } });
  const result = service.bidderBalances([
    group('usd', 'PAID', '0.10'), group('USD', 'PAID', '0.20'),
    group('usd', 'UNPAID', '20.35', 2), group('usd', 'PENDING_CHECKOUT', '1.15'), group('usd', 'AWAITING_EXTERNAL', '3.00'),
    group('usd', 'REFUNDED', '5.00'), group('usd', 'CANCELLED', '7.00'), group('eur', 'UNPAID', '50.00')
  ]);
  assert.deepEqual(result[0], { currency: 'USD', paid: '0.30', outstanding: '24.50', refunded: '5.00', cancelled: '7.00', paidInvoices: 2, unpaidInvoices: 4 });
  assert.equal(result[1].currency, 'EUR'); assert.equal(result[1].outstanding, '50.00');
});
