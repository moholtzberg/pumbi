import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { SUBMISSION_CATEGORIES, defaultSubmissionOpportunity, sellerContactComplete } from '../src/lib/utils/lotSubmission.js';
const state = globalThis.__submissionTests = {};
const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'submission-fixtures', enforce: 'pre', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0submission-db';
    if (id === '$lib/utils/s3Presigned.js') return '\0submission-images';
    if (id === '$lib/server/auctionAutomation.js') return '\0submission-automation';
    if (id === '$env/dynamic/private') return '\0submission-env';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0submission-db') return 'export default new Proxy({}, {get:(_,key)=>globalThis.__submissionTests.db[key]});';
    if (id === '\0submission-images') return 'export const convertToPresignedUrl=async value=>value;';
    if (id === '\0submission-automation') return 'export const processAuctionAutomation=async()=>{globalThis.__submissionTests.cronRuns++;return {errors:[]};};';
    if (id === '\0submission-env') return 'export const env=globalThis.__submissionTests.env;';
  }
}] });
state.env = { CRON_SECRET: 'fixture-secret' };
const service = await server.ssrLoadModule('/src/lib/server/seller-submissions.js');
const collection = await server.ssrLoadModule('/src/routes/api/lot-submissions/+server.js');
const record = await server.ssrLoadModule('/src/routes/api/lot-submissions/[id]/+server.js');
const submit = await server.ssrLoadModule('/src/routes/api/lot-submissions/[id]/submit/+server.js');
const cron = await server.ssrLoadModule('/src/routes/api/cron/auctions/+server.js');
after(async () => { await server.close(); delete globalThis.__submissionTests; });
const contact = { displayName: 'Seller', legalName: 'Seller Name', contactEmail: 'test@example.invalid', contactPhone: '+12125550123', address: 'Jerusalem, Israel' };
beforeEach(() => {
  state.cronRuns = 0; state.writes = []; state.user = { id: 'owner' }; state.profile = null;
  state.row = { id: 'draft', title: null, status: 'DRAFT', images: [], auctionId: null, auctionSeriesId: null, sellerProfile: contact };
  state.policy = { id: 'policy', version: 2, sellerTerms: 'Agreed seller terms', sellerCommissionRate: 0.1 };
  state.target = { id: 'sale', startDate: new Date(Date.now() + 86400000), series: null };
  state.db = {
    user: { findUnique: async () => state.user },
    sellerProfile: { findUnique: async () => state.profile, upsert: async args => { state.writes.push(['profile', args]); return state.profile = { id: 'profile' }; } },
    lotSubmission: {
      findFirst: async args => { state.lookup = args; return state.row; }, findUnique: async () => state.row,
      findMany: async () => [],
      create: async args => { state.writes.push(['create', args]); return state.row = { ...state.row, ...args.data }; },
      update: async args => { state.writes.push(['update', args]); return state.row = { ...state.row, ...args.data }; },
      updateMany: async args => { state.writes.push(['submit', args]); return { count: 1 }; }
    },
    lot: { findMany: async args => { state.categoryQuery = args; return [{ category: 'Local silver' }]; } },
    auction: { findFirst: async args => { state.targetQuery = args; return state.target; }, findMany: async () => [] },
    auctionSeries: { findFirst: async () => state.target, findMany: async () => [] },
    platformPolicy: { findFirst: async () => state.policy }
  };
});
const event = (body = {}, id = 'draft') => ({ locals: { auth: async () => ({ user: { email: 'owner@example.invalid' } }) }, params: { id }, request: new Request('https://pumbi.test/api/lot-submissions', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) });
const fails = async (promise, status, message) => assert.rejects(promise, err => err.status === status && (!message || err.body?.message?.includes(message)));

test('draft input accepts missing title, prices and destination while rejecting conflicting or invalid input', () => {
  const data = service.readSubmissionInput({ title: '', category: '', auctionId: null, auctionSeriesId: null, requestedStartingBid: '' });
  assert.equal(data.title, null); assert.equal(data.auctionId, null); assert.equal(data.requestedStartingBid, null);
  assert.throws(() => service.readSubmissionInput({ auctionId: 'sale', auctionSeriesId: 'series' }), err => err.status === 400);
  assert.throws(() => service.readSubmissionInput({ requestedStartingBid: -1 }), err => err.status === 400);
  assert.throws(() => service.readSubmissionInput({ title: {} }), err => err.status === 400);
});
test('category choices are present for a new seller and only use ready public catalog categories', async () => {
  const result = await (await collection.GET(event())).json();
  for (const category of SUBMISSION_CATEGORIES) assert.ok(result.categories.includes(category));
  assert.ok(result.categories.includes('Local silver'));
  assert.equal(state.categoryQuery.where.auction.type, 'PUBLIC'); assert.equal(state.categoryQuery.where.isReady, true);
  assert.deepEqual(result.opportunities, { series: [], auctions: [] });
});
test('first draft saves without contact profile, title, image, policy or auction', async () => {
  state.policy = null;
  const result = await collection.POST(event({ title: '', auctionId: null, auctionSeriesId: null, images: [] }));
  assert.equal(result.status, 201); assert.equal((await result.json()).submission.id, 'draft');
  assert.deepEqual(state.writes.map(x => x[0]), ['profile', 'create']);
  assert.equal(state.writes[0][1].create.userId, 'owner'); assert.equal(state.writes[1][1].data.sellerProfileId, 'profile');
  assert.equal(state.writes[1][1].data.auctionId, null);
});
test('draft edits keep ownership checks, may clear a target, and can preserve a public target after cutoff', async () => {
  state.row.auctionId = 'sale';
  state.target.startDate = new Date(0);
  await record.PATCH(event({ title: 'Draft after cutoff' }));
  assert.equal(state.lookup.where.sellerProfile.userId, 'owner');
  assert.equal(state.targetQuery.where.type, 'PUBLIC'); assert.equal(state.targetQuery.where.startDate, undefined);
  await record.PATCH(event({ auctionId: null, auctionSeriesId: null }));
  assert.equal(state.row.auctionId, null);
  state.row = null; await fails(record.PATCH(event({ title: 'Not mine' })), 404);
});
test('private targets and submitted drafts cannot be edited', async () => {
  state.target = null; await fails(collection.POST(event({ auctionId: 'private', auctionSeriesId: null })), 400);
  assert.equal(state.writes.length, 0);
  state.row.status = 'SUBMITTED'; await fails(record.PATCH(event({ title: 'Changed' })), 409);
});
test('submitting requires complete contact details, a title, terms acceptance, an open public target and the current policy', async () => {
  const body = { acceptedTerms: true, policyId: 'policy', policyVersion: 2 };
  await fails(submit.POST(event(body)), 400, 'title');
  state.row.title = 'Ready lot'; state.row.sellerProfile = {}; await fails(submit.POST(event(body)), 400, 'seller details');
  state.row.sellerProfile = contact; await fails(submit.POST(event(body)), 400, 'Choose exactly');
  state.row.auctionId = 'sale'; await fails(submit.POST(event({ ...body, acceptedTerms: false })), 400);
  await fails(submit.POST(event({ ...body, policyVersion: 1 })), 409, 'terms changed');
  state.target = null; await fails(submit.POST(event(body)), 400, 'no longer available');
  assert.equal(state.writes.length, 0);
});
test('valid submission records the accepted policy and ownership-constrained state transition', async () => {
  state.row.title = 'Ready lot'; state.row.auctionId = 'sale';
  assert.equal((await submit.POST(event({ acceptedTerms: true, policyId: 'policy', policyVersion: 2 }))).status, 200);
  assert.equal(state.writes[0][0], 'submit');
  const args = state.writes[0][1]; assert.equal(args.where.sellerProfile.userId, 'owner');
  assert.equal(args.data.status, 'SUBMITTED'); assert.equal(args.data.acceptedSellerTermsSnapshot, state.policy.sellerTerms);
  assert.equal(state.targetQuery.where.status, 'UPCOMING'); assert.ok(state.targetQuery.where.startDate.gt);
});
test('Vercel GET cron is scheduled and retains bearer authentication before auction automation runs', async () => {
  assert.equal(cron.GET, cron.POST);
  const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.ok(config.crons.some(item => item.path === '/api/cron/auctions' && item.schedule === '* * * * *'));
  const request = token => ({ request: new Request('https://pumbi.test/api/cron/auctions', { headers: token ? { authorization: `Bearer ${token}` } : {} }) });
  assert.equal((await cron.GET(request())).status, 401); assert.equal(state.cronRuns, 0);
  assert.equal((await cron.GET(request('fixture-secret'))).status, 200); assert.equal(state.cronRuns, 1);
});
test('only a sole eligible destination is preselected; partial contact details remain incomplete', () => {
  assert.equal(defaultSubmissionOpportunity({ series: [], auctions: [] }), '');
  assert.equal(defaultSubmissionOpportunity({ series: [{ id: 'series' }], auctions: [] }), 'series:series');
  assert.equal(defaultSubmissionOpportunity({ series: [{ id: 'series' }], auctions: [{ id: 'sale' }] }), '');
  assert.equal(sellerContactComplete(contact), true); assert.equal(sellerContactComplete({ ...contact, address: '  ' }), false);
});
