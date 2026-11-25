import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

test('PostgreSQL proxy prices, private maxima, warning locks and hammer winner stay consistent', { skip: process.env.RUN_PROXY_DATABASE_TESTS !== '1' }, async () => {
  await import('dotenv/config');
  const { createServer } = await import('vite');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = createRequire(import.meta.url)('@prisma/client');
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  globalThis.__proxyDatabaseTest = { client };
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
    name: 'real-proxy-fixture', enforce: 'pre', resolveId(id) {
      if (id === '$lib/prisma.js') return '\0proxy-database';
      if (id === '$lib/db.js') return '\0proxy-db-empty';
      if (id === '$lib/server/invoices.js') return '\0proxy-invoices';
      if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
    }, load(id) {
      if (id === '\0proxy-database') return 'export default new Proxy({}, { get: (_, key) => globalThis.__proxyDatabaseTest.client[key] });';
      if (id === '\0proxy-db-empty') return 'export const db = {};';
      if (id === '\0proxy-invoices') return 'export async function createInvoiceForSoldLot(id) { const s=globalThis.__proxyDatabaseTest; s.invoiceLot=await s.client.lot.findUnique({where:{id}}); return {id:"mock-invoice"}; }';
    }
  }] });
  try {
    const before = await client.proxyBid.count();
    const rollback = new Error('ROLLBACK_PROXY_TEST');
    await assert.rejects(client.$transaction(async tx => {
      // Route transactions use the enclosing test transaction, which always rolls back.
      globalThis.__proxyDatabaseTest.client = new Proxy(tx, { get: (target, key) => key === '$transaction' ? callback => callback(tx) : target[key] });
      const nonce = crypto.randomUUID();
      const house = await tx.auctionHouse.create({ data: { name: 'Proxy rollback test', slug: `proxy-test-${nonce}` } });
      const auctioneer = await tx.user.create({ data: { email: `auctioneer-${nonce}@example.invalid`, role: 'PLATFORM_ADMIN' } });
      const alice = await tx.user.create({ data: { email: `alice-${nonce}@example.invalid`, name: 'Alice', isVerifiedBuyer: true } });
      const bob = await tx.user.create({ data: { email: `bob-${nonce}@example.invalid`, name: 'Bob', isVerifiedBuyer: true } });
      const auction = await tx.auction.create({ data: { title: 'Proxy rollback test', auctionHouseId: house.id, sellerId: auctioneer.id, auctioneerId: auctioneer.id, auctioneerStartedAt: new Date(), status: 'LIVE', startDate: new Date(), endDate: new Date(Date.now() + 3600000) } });
      const lot = await tx.lot.create({ data: { auctionId: auction.id, title: 'Test lot', lotNumber: 1, isReady: true, startingBid: 25, bidIncrement: 5, endTime: new Date(Date.now() + 3600000) } });
      await tx.auction.update({ where: { id: auction.id }, data: { settings: JSON.stringify({ onBlockLotId: lot.id }) } });
      await tx.auctionRegistration.createMany({ data: [alice, bob].map(user => ({ auctionId: auction.id, userId: user.id, status: 'APPROVED' })) });
      const bids = await server.ssrLoadModule('/src/routes/api/bids/+server.js');
      const floor = await server.ssrLoadModule('/src/routes/api/auctions/[id]/live/+server.js');
      const event = (user, body) => ({ params: { id: auction.id }, locals: { auth: async () => ({ user: { email: user.email } }) }, request: new Request('https://pumbi.test/api/bids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
      const first = await (await bids.POST(event(alice, { lotId: lot.id, amount: 150 }))).json();
      assert.equal(first.currentBid, 25);
      const warning = await (await floor.POST(event(auctioneer, { action: 'fair_warning', lotId: lot.id }))).json();
      const second = await (await bids.POST(event(bob, { lotId: lot.id, amount: 100 }))).json();
      assert.equal(second.currentBid, 105); assert.equal(second.isLeading, false);
      assert.ok(!JSON.stringify(second).includes('150'));
      const history = await tx.bid.findMany({ where: { lotId: lot.id }, orderBy: [{ timestamp: 'asc' }, { sequence: 'asc' }] });
      assert.deepEqual(history.map(bid => bid.amount), [25, 100, 105]);
      assert.equal(history.at(-1).isAutomatic, true);
      assert.equal(history.at(-1).userId, alice.id);
      assert.ok(history[1].sequence < history[2].sequence);
      await assert.rejects(floor.POST(event(auctioneer, { action: 'close', lotId: lot.id, fairWarningKey: warning.lot.fairWarningKey })), err => err.status === 409);
      const freshWarning = await (await floor.POST(event(auctioneer, { action: 'fair_warning', lotId: lot.id }))).json();
      await floor.POST(event(auctioneer, { action: 'close', lotId: lot.id, fairWarningKey: freshWarning.lot.fairWarningKey }));
      const invoiced = globalThis.__proxyDatabaseTest.invoiceLot;
      assert.equal(invoiced.status, 'SOLD'); assert.equal(invoiced.highestBidderId, alice.id); assert.equal(invoiced.currentBid, 105);
      throw rollback;
    }, { timeout: 30000 }), err => err === rollback);
    assert.equal(await client.proxyBid.count(), before);
  } finally { await server.close(); await client.$disconnect(); delete globalThis.__proxyDatabaseTest; }
});
