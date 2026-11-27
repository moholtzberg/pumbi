import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
test('PostgreSQL drafts save without an auction/profile and submit only with complete contact, open sale and current terms', { skip: process.env.RUN_SUBMISSION_DATABASE_TESTS !== '1' }, async () => {
  await import('dotenv/config');
  const { createServer } = await import('vite');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL }) });
  globalThis.__submissionDatabaseTest = { client };
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [{ name: 'submission-db-test', enforce: 'pre', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0submission-database';
    if (id === '$lib/utils/s3Presigned.js') return '\0submission-images';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0submission-database') return 'export default new Proxy({}, {get:(_,key)=>globalThis.__submissionDatabaseTest.client[key]});';
    if (id === '\0submission-images') return 'export const convertToPresignedUrl=async value=>value;';
  } }] });
  try {
    const before = await client.lotSubmission.count();
    const rollback = new Error('ROLLBACK_SUBMISSION_FIXTURE');
    await assert.rejects(client.$transaction(async tx => {
      globalThis.__submissionDatabaseTest.client = tx;
      const suffix = crypto.randomUUID();
      const user = await tx.user.create({ data: { email: `submission-${suffix}@example.invalid`, name: 'Draft test' } });
      const outsider = await tx.user.create({ data: { email: `outsider-${suffix}@example.invalid` } });
      const collection = await server.ssrLoadModule('/src/routes/api/lot-submissions/+server.js');
      const record = await server.ssrLoadModule('/src/routes/api/lot-submissions/[id]/+server.js');
      const submit = await server.ssrLoadModule('/src/routes/api/lot-submissions/[id]/submit/+server.js');
      const event = (body, id, actor = user) => ({ params: { id }, locals: { auth: async () => ({ user: { email: actor.email } }) }, request: new Request('https://pumbi.test/api/lot-submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
      const draft = (await (await collection.POST(event({ title: '', images: [], auctionId: null, auctionSeriesId: null }))).json()).submission;
      assert.equal(draft.status, 'DRAFT'); assert.equal(draft.auctionId, null); assert.equal(draft.title, null);
      const workspace = await (await collection.GET(event({}))).json();
      assert.ok(workspace.categories.includes('Books'));
      assert.ok(workspace.submissions.some(item => item.id === draft.id));
      assert.ok(await tx.sellerProfile.findUnique({ where: { userId: user.id } }));
      const photoDraft = await (await record.PATCH(event({ images: [{ key: 'lots/submission-photo.png' }] }, draft.id))).json();
      assert.equal(photoDraft.submission.images[0].key, 'lots/submission-photo.png');
      assert.ok(photoDraft.submission.images[0].previewUrl);
      await assert.rejects(record.PATCH(event({ title: 'Wrong owner' }, draft.id, outsider)), err => err.status === 404);
      await record.PATCH(event({ title: 'Ready for review', category: 'Books', auctionId: null, auctionSeriesId: null }, draft.id));
      const house = await tx.auctionHouse.create({ data: { name: 'Submission fixture', slug: `submission-${suffix}` } });
      const auction = await tx.auction.create({ data: { auctionHouseId: house.id, sellerId: user.id, title: 'Future public sale', type: 'PUBLIC', startDate: new Date(Date.now() + 86400000), endDate: new Date(Date.now() + 172800000) } });
      await record.PATCH(event({ auctionId: auction.id, auctionSeriesId: null }, draft.id));
      const maxVersion = (await tx.platformPolicy.aggregate({ _max: { version: true } }))._max.version || 0;
      const policy = await tx.platformPolicy.create({ data: { version: maxVersion + 1, createdById: user.id, buyerTerms: 'Fixture buyer terms', sellerTerms: 'Fixture seller terms', buyerPremiumRate: 0.1, sellerCommissionRate: 0.1, isActive: true, effectiveFrom: new Date() } });
      const acceptance = { acceptedTerms: true, policyId: policy.id, policyVersion: policy.version };
      await assert.rejects(submit.POST(event(acceptance, draft.id)), err => err.status === 400 && /seller details/.test(err.body.message));
      await tx.sellerProfile.update({ where: { userId: user.id }, data: { displayName: 'Seller', legalName: 'Seller Name', contactEmail: user.email, contactPhone: '+12125550123', address: 'Jerusalem, Israel' } });
      await assert.rejects(submit.POST(event({ ...acceptance, policyVersion: policy.version - 1 }, draft.id)), err => err.status === 409);
      const result = await (await submit.POST(event(acceptance, draft.id))).json();
      assert.equal(result.submission.status, 'SUBMITTED'); assert.equal(result.submission.acceptedPolicyVersion, policy.version);
      await assert.rejects(record.PATCH(event({ title: 'Cannot edit after submit' }, draft.id)), err => err.status === 409);
      assert.equal(await tx.lotSubmission.count({ where: { sellerProfile: { userId: user.id } } }), 1);
      throw rollback;
    }, { timeout: 30000 }), err => err === rollback);
    assert.equal(await client.lotSubmission.count(), before);
  } finally { await server.close(); await client.$disconnect(); delete globalThis.__submissionDatabaseTest; }
});
