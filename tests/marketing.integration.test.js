import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Opt-in: uses configured PostgreSQL, creates only test fixtures, always rolls back.
test('marketing outbox and opt-outs work with real PostgreSQL constraints and relations', { skip: process.env.RUN_MARKETING_DATABASE_TESTS !== '1' }, async () => {
  await import('dotenv/config');
  const { createServer } = await import('vite');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = createRequire(import.meta.url)('@prisma/client');
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  globalThis.__crmRealCheck = { client, env: { AUTH_SECRET: 'integration-test-only' } };
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{ name: 'crm-real-check', enforce: 'pre', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0crm-real-prisma';
    if (id === '$env/dynamic/private') return '\0crm-real-env';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0crm-real-prisma') return 'export default globalThis.__crmRealCheck.client;';
    if (id === '\0crm-real-env') return 'export const env = globalThis.__crmRealCheck.env;';
  } }] });
  try {
    const service = await server.ssrLoadModule('/src/lib/server/marketing.js');
    const preferences = await server.ssrLoadModule('/src/lib/server/marketingPreferences.js');
    const before = await client.marketingMessage.count();
    const rollback = new Error('ROLLBACK_TEST');
    await assert.rejects(client.$transaction(async tx => {
      const suffix = crypto.randomUUID();
      const house = await tx.auctionHouse.create({ data: { name: 'CRM rollback test', slug: `crm-test-${suffix}`, onboardingStatus: 'APPROVED' } });
      const otherHouse = await tx.auctionHouse.create({ data: { name: 'Other CRM rollback test', slug: `crm-other-test-${suffix}` } });
      const seller = await tx.user.create({ data: { email: `crm-seller-${suffix}@example.invalid`, role: 'SELLER' } });
      const auction = await tx.auction.create({ data: { title: 'CRM rollback test', auctionHouseId: house.id, sellerId: seller.id, startDate: new Date(Date.now() + 20 * 60000), endDate: new Date(Date.now() + 3600000) } });
      const campaign = await tx.marketingCampaign.create({ data: { auctionId: auction.id, auctionHouseId: house.id, siteUrl: 'https://example.invalid' } });
      const email = `crm-contact-${suffix}@example.invalid`;
      const contact = await tx.marketingContact.create({ data: { auctionHouseId: house.id, email } });
      assert.equal((await tx.marketingContact.createMany({ data: [{ auctionHouseId: house.id, email }], skipDuplicates: true })).count, 0);
      assert.equal((await tx.marketingContact.createMany({ data: [{ auctionHouseId: otherHouse.id, email }], skipDuplicates: true })).count, 1);
      assert.equal((await service.queueInvitations(campaign, [contact], tx)).queued, 1);
      assert.equal((await service.queueInvitations(campaign, [contact], tx)).queued, 0);
      let sends = 0;
      const result = await service.processMarketing({ client: tx, houseId: house.id, send: async message => {
        assert.equal(message.to, email); sends++;
        return { data: { email_id: 'mock-accepted-no-network' } };
      } });
      assert.equal(sends, 2); assert.equal(result.accepted, 2); // Invitation and start reminder.
      await preferences.unsubscribe(preferences.unsubscribeToken(house.id, email), { $transaction: async callback => callback(tx) });
      assert.equal((await tx.marketingContact.findUnique({ where: { id: contact.id } })).subscribed, false);
      await tx.marketingContact.delete({ where: { id: contact.id } });
      assert.equal(await tx.marketingMessage.count({ where: { contactId: contact.id } }), 0);
      assert.equal(await tx.marketingSuppression.count({ where: { auctionHouseId: house.id, email } }), 1);
      throw rollback;
    }, { timeout: 30000 }), err => err === rollback);
    assert.equal(await client.marketingMessage.count(), before);
  } finally { await server.close(); await client.$disconnect(); delete globalThis.__crmRealCheck; }
});
