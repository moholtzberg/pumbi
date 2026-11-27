import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
test('PostgreSQL lot creation saves images together, rejects invalid/duplicate lots without leftovers and protects catalog writes', { skip: process.env.RUN_LOT_CREATION_DATABASE_TESTS !== '1' }, async () => {
  await import('dotenv/config'); const { createServer } = await import('vite');
  const { PrismaPg } = await import('@prisma/adapter-pg'); const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL }) });
  globalThis.__lotCreationDatabase = { client };
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [{ name: 'lot-create-database', enforce: 'pre', resolveId(id, importer) {
    if (id === '$lib/prisma.js' || (id === './prisma.js' && importer?.endsWith('/src/lib/db.js'))) return '\0create-lot-db';
    if (id === '$lib/utils/s3Presigned.js') return '\0create-lot-previews';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0create-lot-db') return 'export default new Proxy({}, {get:(_,key)=>globalThis.__lotCreationDatabase.client[key]});';
    if (id === '\0create-lot-previews') return `export const convertToPresignedUrl=async url=>url?.startsWith('http')?url:'https://storage.example/'+url;export const convertImageObjects=async images=>Promise.all(images.map(async image=>({...image,url:await convertToPresignedUrl(image.url)})));`;
  } }] });
  try {
    const before = await client.lot.count(), rollback = new Error('ROLLBACK_LOT_CREATION');
    await assert.rejects(client.$transaction(async tx => {
      globalThis.__lotCreationDatabase.client = tx;
      const unique = crypto.randomUUID();
      const admin = await tx.user.create({ data: { email: `lot-create-${unique}@example.invalid`, role: 'PLATFORM_ADMIN' } });
      const outsider = await tx.user.create({ data: { email: `lot-outside-${unique}@example.invalid` } });
      const house = await tx.auctionHouse.create({ data: { name: 'Lot test', slug: `lot-${unique}` } });
      const auction = await tx.auction.create({ data: { title: 'Lot test sale', auctionHouseId: house.id, sellerId: admin.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) } });
      const route = await server.ssrLoadModule('/src/routes/api/lots/+server.js');
      const event = (body, actor = admin) => ({ locals: { auth: async () => ({ user: { email: actor.email } }) }, request: new Request('https://pumbi.test/api/lots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
      const body = { auctionId: auction.id, lotNumber: 10, title: 'Uploaded photo lot', startingBid: 25, bidIncrement: 5, status: 'active', endTime: '', uploadedImages: [{ key: 'lots/photo.png' }], tags: ['test'], metaFields: { condition: 'Good' }, images: [{ url: 'lots/photo.png', key: 'lots/photo.png' }, { url: 'https://example.invalid/second.png' }] };
      const response = await route.POST(event(body));
      assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
      const created = await response.json(); assert.equal(created.lotNumber, 10); assert.equal(created.images.length, 2);
      assert.equal(created.images.filter(image => image.isPrimary).length, 1); assert.equal(created.images[0].cloudKey, 'lots/photo.png');
      const count = await tx.lot.count({ where: { auctionId: auction.id } });
      await tx.$executeRawUnsafe('SAVEPOINT duplicate_lot_test');
      assert.equal((await route.POST(event(body))).status, 409);
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT duplicate_lot_test');
      assert.equal(await tx.lot.count({ where: { auctionId: auction.id } }), count);
      await assert.rejects(route.POST(event({ ...body, lotNumber: 11, images: [{ url: 'javascript:bad' }] })), err => err.status === 400);
      assert.equal(await tx.lot.count({ where: { auctionId: auction.id } }), count);
      await assert.rejects(route.POST(event({ ...body, lotNumber: 12 }, outsider)), err => err.status === 403);
      assert.equal((await route.POST(event({ ...body, lotNumber: 13, startingBid: -1 }))).status, 400);
      throw rollback;
    }, { timeout: 30000 }), err => err === rollback);
    assert.equal(await client.lot.count(), before);
  } finally { await server.close(); await client.$disconnect(); delete globalThis.__lotCreationDatabase; }
});
