import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const state = globalThis.__analyticsAccessTest = {};
const fail = status => { const err = new Error('Denied'); err.status = status; throw err; };
state.prisma = {
  auction: { findUnique: async () => state.auction, groupBy: async () => [] },
  lot: { findFirst: async ({ where }) => where.auctionId === 'auction' && where.id === 'own-lot' ? { id: 'own-lot', startingBid: 10 } : null },
  invoice: { groupBy: async args => { state.invoiceQueries.push(args); return []; } },
  $queryRaw: async (strings, ...params) => {
    state.queries.push({ text: strings.join('?'), params });
    return strings.join('').includes('NTILE') ? [] : [{ sold: 1, unsold: 0, totalLots: 1, hammerTotal: 25, inRoom: 2, activeBidders: 1, totalBids: 3, totalBidders: 1 }];
  }
};
state.auth = {
  HOUSE_PERMISSIONS: { VIEW: 'VIEW', MANAGE_FINANCE: 'MANAGE_FINANCE' },
  requireAuthenticatedUser: async () => state.user || fail(401),
  requireAuctionHousePermission: async (user, id) => id === 'house' ? { role: state.role } : fail(403),
  permissionsForHouseRole: role => role === 'OWNER' ? ['VIEW', 'MANAGE_FINANCE'] : ['VIEW']
};
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'analytics-test-adapters', resolveId(id) {
    if (id === '$lib/prisma.js' || id === '$lib/server/authorization.js') return '\0' + id;
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0$lib/prisma.js') return 'export default globalThis.__analyticsAccessTest.prisma;';
    if (id === '\0$lib/server/authorization.js') return 'export const { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionHousePermission, permissionsForHouseRole } = globalThis.__analyticsAccessTest.auth;';
  }
}] });
const seller = await server.ssrLoadModule('/src/routes/api/seller/analytics/+server.js');
const activity = await server.ssrLoadModule('/src/routes/api/auctions/[id]/activity/+server.js');
after(async () => { await server.close(); delete globalThis.__analyticsAccessTest; });
beforeEach(() => {
  state.user = { id: 'seller', auctionHouseId: 'house' };
  state.role = 'OWNER'; state.auction = { id: 'auction', status: 'LIVE' };
  state.queries = []; state.invoiceQueries = [];
});
const event = query => ({ locals: {}, params: { id: 'auction' }, url: new URL('https://pumbi.test/activity' + (query || '')) });

test('seller analytics rejects anonymous and other-house requests before querying totals', async () => {
  await assert.rejects(seller.GET(event('?auctionHouseId=another-house')), err => err.status === 403);
  state.user = null;
  await assert.rejects(seller.GET(event()), err => err.status === 401);
  assert.equal(state.queries.length, 0);
});
test('authorized totals query only the selected house and are never publicly cached', async () => {
  const response = await seller.GET(event());
  assert.match(response.headers.get('cache-control'), /private/);
  assert.deepEqual(state.queries[0].params, ['house']);
  assert.ok(state.invoiceQueries.every(query => query.where.auctionHouseId === 'house'));
  assert.equal((await response.json()).sales.hammerTotal, 25);
});
test('non-finance users never query invoices or receive sale values', async () => {
  state.role = 'AUCTION_MANAGER';
  const response = await seller.GET(event());
  assert.equal(state.invoiceQueries.length, 0);
  assert.equal((await response.json()).sales.hammerTotal, undefined);
});
test('activity rejects a lot from another auction and missing auctions', async () => {
  await assert.rejects(activity.GET(event('?lotId=foreign-lot')), err => err.status === 404);
  assert.equal(state.queries.length, 0);
  state.auction = null;
  await assert.rejects(activity.GET(event()), err => err.status === 404);
});
test('public activity contains aggregates and bound parameters, without visitor details', async () => {
  const response = await activity.GET(event('?lotId=own-lot'));
  const body = await response.json();
  assert.equal(body.inRoom, 2);
  assert.deepEqual(body.history, []);
  assert.equal(body.visitorKey, undefined);
  assert.equal(body.userId, undefined);
  assert.ok(state.queries[1].params.includes('own-lot'));
});

test('finished auctions retain bid history but report no current bidding', async () => {
  state.auction.status = 'ENDED';
  const body = await (await activity.GET(event())).json();
  assert.equal(body.finished, true);
  assert.equal(body.activeBidders, 0);
  assert.equal(body.totalBids, 3);
});
