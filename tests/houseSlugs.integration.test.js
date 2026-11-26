import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
test(
  'PostgreSQL slugs resolve public house catalogs, reject case collisions and follow admin slug edits',
  { skip: process.env.RUN_STOREFRONT_DATABASE_TESTS !== '1' },
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
    globalThis.__storefrontDatabase = { client };
    const server = await createServer({
      configFile: false,
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      plugins: [
        {
          name: 'storefront-db',
          enforce: 'pre',
          resolveId(id) {
            if (id === '$lib/prisma.js') return '\0storefront-db';
            if (id === '$lib/utils/s3Presigned.js')
              return '\0storefront-images';
            if (id.startsWith('$lib/'))
              return fileURLToPath(
                new URL('../src/lib/' + id.slice(5), import.meta.url),
              );
          },
          load(id) {
            if (id === '\0storefront-db')
              return 'export default new Proxy({}, {get:(_,key)=>globalThis.__storefrontDatabase.client[key]});';
            if (id === '\0storefront-images')
              return 'export const convertToPresignedUrl=async value=>value;';
          },
        },
      ],
    });
    try {
      const before = await client.auctionHouse.count();
      const rollback = new Error('ROLLBACK_STOREFRONT');
      await assert.rejects(
        client.$transaction(
          async (tx) => {
            globalThis.__storefrontDatabase.client = new Proxy(tx, {
              get: (target, key) =>
                key === '$transaction'
                  ? (callback) => callback(tx)
                  : target[key],
            });
            const suffix = crypto.randomUUID();
            const actor = await tx.user.create({
              data: {
                email: `storefront-${suffix}@example.invalid`,
                role: 'PLATFORM_ADMIN',
              },
            });
            const house = await tx.auctionHouse.create({
              data: {
                name: 'Storefront test',
                slug: `store-${suffix}`,
                isActive: true,
                onboardingStatus: 'APPROVED',
                contactEmail: 'house@example.invalid',
                settings: '{"privateKey":"PRIVATE_KEY"}',
              },
            });
            const foreign = await tx.auctionHouse.create({
              data: {
                name: 'Other test',
                slug: `other-${suffix}`,
                isActive: true,
                onboardingStatus: 'APPROVED',
              },
            });
            const createSale = (houseId, status, title) =>
              tx.auction.create({
                data: {
                  auctionHouseId: houseId,
                  sellerId: actor.id,
                  status,
                  title,
                  startDate: new Date(),
                  endDate: new Date(Date.now() + 3600000),
                },
              });
            const current = await createSale(
              house.id,
              'UPCOMING',
              'Current sale',
            );
            await createSale(house.id, 'ENDED', 'Past sale');
            await createSale(foreign.id, 'UPCOMING', 'FOREIGN_SALE');
            await tx.lot.create({
              data: {
                auctionId: current.id,
                lotNumber: 1,
                title: 'Ready',
                isReady: true,
                startingBid: 25,
                bidIncrement: 5,
              },
            });
            await tx.lot.create({
              data: {
                auctionId: current.id,
                lotNumber: 2,
                title: 'PRIVATE_DRAFT',
                isReady: false,
                startingBid: 25,
                bidIncrement: 5,
              },
            });
            const { loadHouseStorefront } = await server.ssrLoadModule(
              '/src/lib/server/houseStorefront.js',
            );
            const admin = await server.ssrLoadModule(
              '/src/lib/server/adminData.js',
            );
            const event = (slug, query = '') => ({
              params: { slug },
              url: new URL(`https://pumbi.test/${slug}${query}`),
            });
            const page = await loadHouseStorefront(event(house.slug));
            assert.equal(page.auctions.length, 1);
            assert.equal(page.auctions[0].lotCount, 1);
            assert.equal(page.house.email, 'house@example.invalid');
            assert.ok(!JSON.stringify(page).includes('PRIVATE_'));
            assert.ok(!JSON.stringify(page).includes('FOREIGN_SALE'));
            const past = await loadHouseStorefront(
              event(house.slug, '?status=past'),
            );
            assert.equal(past.auctions.length, 1);
            assert.equal(past.auctions[0].title, 'Past sale');
            const legacy = await tx.auctionHouse.create({
              data: {
                name: 'Legacy case',
                slug: `Legacy-${suffix}`,
                isActive: true,
                onboardingStatus: 'APPROVED',
              },
            });
            const legacyPage = await loadHouseStorefront(
              event(legacy.slug.toLowerCase()),
            );
            assert.equal(legacyPage.house.id, legacy.id);
            await assert.rejects(
              admin.mutateRecord({
                key: 'auctionHouse',
                id: foreign.id,
                input: { slug: legacy.slug.toUpperCase() },
                revision: foreign.updatedAt.toISOString(),
                actor,
              }),
              (e) => e.status === 409,
            );
            const newSlug = `renamed-${suffix}`;
            await admin.mutateRecord({
              key: 'auctionHouse',
              id: house.id,
              input: { slug: newSlug.toUpperCase() },
              revision: house.updatedAt.toISOString(),
              actor,
            });
            assert.equal(
              (await loadHouseStorefront(event(newSlug))).house.id,
              house.id,
            );
            await assert.rejects(
              loadHouseStorefront(event(house.slug)),
              (e) => e.status === 404,
            );
            await tx.auctionHouse.update({
              where: { id: house.id },
              data: { isActive: false },
            });
            await assert.rejects(
              loadHouseStorefront(event(newSlug)),
              (e) => e.status === 404,
            );
            throw rollback;
          },
          { timeout: 60000 },
        ),
        (e) => e === rollback,
      );
      assert.equal(await client.auctionHouse.count(), before);
    } finally {
      await server.close();
      await client.$disconnect();
      delete globalThis.__storefrontDatabase;
    }
  },
);
