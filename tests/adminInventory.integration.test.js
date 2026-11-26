import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
test(
  'PostgreSQL admin inventory scopes houses, includes private auctions, edits and removes with revision guards',
  { skip: process.env.RUN_ADMIN_DATABASE_TESTS !== '1' },
  async () => {
    await import('dotenv/config');
    const { createServer } = await import('vite');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { PrismaClient } = createRequire(import.meta.url)('@prisma/client');
    const client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString:
          process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      }),
    });
    globalThis.__adminInventoryDatabase = { client };
    const server = await createServer({
      configFile: false,
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      plugins: [
        {
          name: 'admin-inventory-database',
          enforce: 'pre',
          resolveId(id) {
            if (id === '$lib/prisma.js') return '\0admin-inventory-db';
            if (id.startsWith('$lib/'))
              return fileURLToPath(
                new URL('../src/lib/' + id.slice(5), import.meta.url),
              );
          },
          load(id) {
            if (id === '\0admin-inventory-db')
              return 'export default new Proxy({}, {get:(_,key)=>globalThis.__adminInventoryDatabase.client[key]});';
          },
        },
      ],
    });
    try {
      const before = await client.auctionHouse.count();
      const rollback = new Error('ROLLBACK_ADMIN_INVENTORY');
      await assert.rejects(
        client.$transaction(
          async (tx) => {
            globalThis.__adminInventoryDatabase.client = new Proxy(tx, {
              get: (target, key) =>
                key === '$transaction'
                  ? (callback) => callback(tx)
                  : target[key],
            });
            const suffix = crypto.randomUUID();
            const admin = await tx.user.create({
              data: {
                email: `inventory-${suffix}@example.invalid`,
                role: 'PLATFORM_ADMIN',
              },
            });
            const house = await tx.auctionHouse.create({
              data: {
                name: `Inventory test ${suffix}`,
                slug: `inventory-${suffix}`,
              },
            });
            const makeAuction = (type, title) =>
              tx.auction.create({
                data: {
                  auctionHouseId: house.id,
                  sellerId: admin.id,
                  type,
                  title,
                  startDate: new Date(),
                  endDate: new Date(Date.now() + 3600000),
                  currency: type === 'PRIVATE' ? 'ils' : 'usd',
                },
              });
            const privateSale = await makeAuction(
              'PRIVATE',
              `Private ${suffix}`,
            );
            await makeAuction('PUBLIC', `Public ${suffix}`);
            const lot = await tx.lot.create({
              data: {
                auctionId: privateSale.id,
                lotNumber: 1,
                title: 'ספר',
                startingBid: 25,
                bidIncrement: 5,
              },
            });
            await tx.lot.create({
              data: {
                auctionId: privateSale.id,
                lotNumber: 2,
                title: 'Other test lot',
                startingBid: 25,
                bidIncrement: 5,
              },
            });
            const inventory = await server.ssrLoadModule(
              '/src/lib/server/adminInventory.js',
            );
            const records = await server.ssrLoadModule(
              '/src/lib/server/adminData.js',
            );
            const event = (query) => ({
              locals: { auth: async () => ({ user: { id: admin.id } }) },
              url: new URL('https://pumbi.test/admin/auctions' + query),
            });
            const sales = await inventory.loadAdminInventory(
              'auction',
              event(`?house=${house.id}`),
            );
            assert.equal(sales.total, 2);
            assert.deepEqual(
              new Set(sales.rows.map((row) => row.type)),
              new Set(['PUBLIC', 'PRIVATE']),
            );
            const lots = await inventory.loadAdminInventory(
              'lot',
              event(`?house=${house.id}&auction=${privateSale.id}&q=${encodeURIComponent('ספר')}`),
            );
            assert.equal(lots.total, 1);
            assert.equal(lots.rows[0].id, lot.id);
            assert.equal(lots.rows[0].auction.currency, 'ils');
            const updated = await records.mutateRecord({
              key: 'lot',
              id: lot.id,
              input: { title: 'Updated Hebrew book' },
              revision: lot.updatedAt.toISOString(),
              actor: admin,
            });
            assert.equal(updated.record.title, 'Updated Hebrew book');
            await assert.rejects(
              records.mutateRecord({
                key: 'lot',
                id: lot.id,
                input: { title: 'Stale' },
                revision: lot.updatedAt.toISOString(),
                actor: admin,
              }),
              (err) => err.status === 409,
            );
            await assert.rejects(
              records.mutateRecord({
                key: 'lot',
                id: lot.id,
                input: {},
                revision: updated.record.updatedAt,
                actor: admin,
                deleting: true,
                confirmation: 'wrong',
              }),
              (err) => err.status === 400,
            );
            const removed = await records.mutateRecord({
              key: 'lot',
              id: lot.id,
              input: {},
              revision: updated.record.updatedAt,
              actor: admin,
              deleting: true,
              confirmation: lot.id,
            });
            assert.equal(removed.deleted, true);
            assert.equal(
              await tx.lot.count({ where: { auctionId: privateSale.id } }),
              1,
            );
            const deactivated = await records.mutateRecord({
              key: 'auctionHouse',
              id: house.id,
              input: { isActive: false },
              revision: house.updatedAt.toISOString(),
              actor: admin,
            });
            assert.equal(deactivated.record.isActive, false);
            const seller = await tx.user.create({
              data: {
                email: `seller-${suffix}@example.invalid`,
                role: 'SELLER',
              },
            });
            await assert.rejects(
              inventory.loadAdminInventory('auction', {
                locals: { auth: async () => ({ user: { id: seller.id } }) },
                url: event('').url,
              }),
              (err) => err.status === 403,
            );
            throw rollback;
          },
          { timeout: 60000 },
        ),
        (err) => err === rollback,
      );
      assert.equal(await client.auctionHouse.count(), before);
    } finally {
      await server.close();
      await client.$disconnect();
      delete globalThis.__adminInventoryDatabase;
    }
  },
);
