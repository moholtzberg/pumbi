import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const state = globalThis.__marketingTest = { env: { SMTP2GO_API_KEY: 'test', AUTH_SECRET: 'test-secret', CRON_SECRET: 'test-cron' } };
const models = ['auctionHouse', 'auction', 'user', 'marketingContact', 'marketingCampaign', 'marketingEnrollment', 'marketingSuppression', 'marketingMessage', 'lot', 'lotWatch', 'auctionRegistration'];
function match(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return expected.some(part => match(row, part));
    if (key === 'AND') return expected.every(part => match(row, part));
    const value = row?.[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('in' in expected) return expected.in.includes(value);
      if ('notIn' in expected) return !expected.notIn.includes(value);
      if ('contains' in expected) return String(value || '').toLowerCase().includes(expected.contains.toLowerCase());
      if ('lt' in expected) return value && value < expected.lt;
      if ('lte' in expected) return value && value <= expected.lte;
      return match(value === undefined ? row : value, expected);
    }
    return value instanceof Date ? value.getTime() === expected?.getTime() : value === expected;
  });
}
function joined(model, row) {
  if (!row) return null;
  const find = (table, id) => state.items[table].find(item => item.id === id);
  return { ...row,
    ...(model === 'marketingCampaign' ? { auction: find('auction', row.auctionId), auctionHouse: find('auctionHouse', row.auctionHouseId) } : {}),
    ...(model === 'marketingEnrollment' ? { contact: find('marketingContact', row.contactId) } : {}),
    ...(model === 'marketingMessage' ? { contact: find('marketingContact', row.contactId), campaign: joined('marketingCampaign', find('marketingCampaign', row.campaignId)) } : {}),
    ...(['auctionRegistration', 'lotWatch'].includes(model) ? { user: find('user', row.userId) } : {})
  };
}
const client = {};
for (const model of models) {
  const query = args => state.items[model].filter(row => match(joined(model, row), args?.where)).map(row => joined(model, row));
  client[model] = {
    findMany: async args => query(args).slice(args?.skip || 0, (args?.skip || 0) + (args?.take || 1e6)),
    findFirst: async args => query(args)[0] || null,
    findUnique: async args => query(args)[0] || null,
    count: async args => query(args).length,
    upsert: async ({ where, create, update }) => {
      let row = state.items[model].find(item => match(item, where));
      if (row) Object.assign(row, update); else { row = { id: `${model}-${++state.ids}`, subscribed: true, status: 'QUEUED', createdAt: new Date(), ...create }; state.items[model].push(row); }
      return structuredClone(row);
    },
    createMany: async ({ data }) => {
      let count = 0;
      for (const input of data) {
        const duplicate = state.items[model].some(row => model === 'marketingEnrollment' ? row.campaignId === input.campaignId && row.contactId === input.contactId : row.auctionHouseId === input.auctionHouseId && row.email === input.email && row.eventKey === input.eventKey);
        if (duplicate) continue;
        state.items[model].push({ id: `${model}-${++state.ids}`, status: 'QUEUED', createdAt: new Date(), ...input }); count++;
      }
      return { count };
    },
    updateMany: async ({ where, data }) => {
      const rows = state.items[model].filter(row => match(row, where));
      rows.forEach(row => Object.assign(row, data)); return { count: rows.length };
    },
    update: async ({ where, data }) => {
      const row = state.items[model].find(row => match(row, where));
      if (!row) throw new Error('Missing fixture row');
      Object.assign(row, data); return structuredClone(row);
    },
    deleteMany: async ({ where }) => {
      const rows = state.items[model].filter(row => match(row, where));
      state.items[model] = state.items[model].filter(row => !rows.includes(row)); return { count: rows.length };
    },
    groupBy: async () => []
  };
}
client.$transaction = async callback => {
  const snapshot = structuredClone(state.items);
  try { return await callback(client); } catch (err) { state.items = snapshot; throw err; }
};
state.client = client;
const deny = status => { const e = new Error('Denied'); e.status = status; throw e; };
state.auth = {
  HOUSE_PERMISSIONS: { MANAGE_BIDDERS: 'MANAGE_BIDDERS', MANAGE_AUCTIONS: 'MANAGE_AUCTIONS' },
  requireAuthenticatedUser: async locals => locals.user || deny(401),
  requireAuctionHousePermission: async (user, houseId) => user.houseId === houseId && state.allowed ? null : deny(403)
};
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'marketing-fixtures', enforce: 'pre', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0marketing-prisma';
    if (id === '$env/dynamic/private') return '\0marketing-env';
    if (id === '$lib/server/authorization.js' || id === './authorization.js') return '\0marketing-auth';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0marketing-prisma') return 'export default globalThis.__marketingTest.client;';
    if (id === '\0marketing-env') return 'export const env = globalThis.__marketingTest.env;';
    if (id === '\0marketing-auth') return 'export const { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionHousePermission } = globalThis.__marketingTest.auth;';
  }
}] });
const service = await server.ssrLoadModule('/src/lib/server/marketing.js');
const contacts = await server.ssrLoadModule('/src/lib/server/marketingContacts.js');
const preferences = await server.ssrLoadModule('/src/lib/server/marketingPreferences.js');
const templates = await server.ssrLoadModule('/src/lib/server/marketingTemplates.js');
const api = await server.ssrLoadModule('/src/routes/api/auction-houses/[id]/marketing/+server.js');
const cron = await server.ssrLoadModule('/src/routes/api/cron/marketing/+server.js');
after(async () => { await server.close(); delete globalThis.__marketingTest; });
beforeEach(() => {
  state.ids = 0; state.allowed = true;
  state.items = Object.fromEntries(models.map(model => [model, []]));
  state.items.auctionHouse = [{ id: 'house', name: 'House & Co', isActive: true, onboardingStatus: 'APPROVED' }];
  state.items.auction = [{ id: 'auction', auctionHouseId: 'house', title: 'Rare books', status: 'UPCOMING', startDate: new Date(Date.now() + 20 * 60_000), endDate: new Date(Date.now() + 120 * 60_000) }];
  state.items.marketingCampaign = [{ id: 'campaign', auctionId: 'auction', auctionHouseId: 'house', enabled: true, auctionReminders: true, lotReminders: true, reminderMinutes: 30, siteUrl: 'https://pumbi.example' }];
  state.items.marketingContact = [{ id: 'contact', auctionHouseId: 'house', email: 'buyer@example.com', name: 'Buyer', subscribed: true }];
  state.items.user = [{ id: 'buyer', email: 'buyer@example.com', emailVerifiedAt: new Date() }, { id: 'other', email: 'other@example.com', emailVerifiedAt: new Date() }];
});
const campaign = () => joined('marketingCampaign', state.items.marketingCampaign[0]);
const event = (body, { id = 'house', user = { id: 'seller', houseId: 'house', role: 'SELLER' }, query = '' } = {}) => ({ params: { id }, locals: { user }, url: new URL(`https://pumbi.example/api/auction-houses/${id}/marketing${query}`), request: new Request('https://pumbi.example/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
const invite = () => service.queueInvitations(campaign(), state.items.marketingContact, client);
const send = async () => ({ data: { email_id: 'accepted' } });

test('CSV handles quoted commas, multiline notes, BOM, aliases and normalized duplicates', () => {
  const parsed = contacts.parseContactCsv('\uFEFFfirst_name,last_name,email_address,phone_number,notes\r\nMoshe,Cohen,MOSHE@example.com,+12125551234,"Likes books, silver"\r\nMoshe,Cohen,moshe@example.com,+12125551234,"A ""quoted"" note\nsecond line"');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].email, 'moshe@example.com');
  assert.equal(parsed[0].name, 'Moshe Cohen');
  assert.equal(parsed[0].notes, 'A "quoted" note\nsecond line');
});

test('CSV rejects invalid records and more than 500 contacts before any import', () => {
  for (const value of ['name\nMoshe', 'email\ninvalid', 'email,name\n"unclosed', 'email,email\na@x.com,b@x.com', 'email,name\na@x.com']) assert.throws(() => contacts.parseContactCsv(value), err => err.status === 400);
  assert.throws(() => contacts.parseContactCsv('email\n' + Array.from({ length: 501 }, (_, i) => `buyer${i}@example.com`).join('\n')), err => err.status === 400);
});

test('imports and invitations require house permission and explicit contact consent', async () => {
  const body = { action: 'save_contacts', contact: { email: 'new@example.com' } };
  await assert.rejects(api.POST(event(body, { user: null })), err => err.status === 401);
  await assert.rejects(api.POST(event(body, { id: 'foreign' })), err => err.status === 403);
  state.allowed = false;
  await assert.rejects(api.POST(event(body)), err => err.status === 403);
  state.allowed = true;
  await assert.rejects(api.POST(event(body)), err => err.status === 400);
  assert.equal(state.items.marketingContact.length, 1);
});

test('CSV import can automatically enroll and invite while deduplicating repeated uploads', async () => {
  const body = { action: 'save_contacts', csv: 'name,email,phone\nMoshe,moshe@example.com,+12125551234\nAgain,MOSHE@example.com,+12125551234', consentConfirmed: true, auctionId: 'auction' };
  const first = await (await api.POST(event(body))).json();
  const second = await (await api.POST(event(body))).json();
  assert.equal(first.saved, 1); assert.equal(first.queued, 1); assert.equal(second.queued, 0);
  assert.equal(state.items.marketingEnrollment.length, 1);
  assert.equal(state.items.user.length, 2); // No login account is created or bidder approved.
  assert.equal(state.items.marketingMessage[0].email, 'moshe@example.com');
});

test('unsubscribe signature is scoped to house/email and tampering is rejected', async () => {
  const token = preferences.unsubscribeToken('house', 'BUYER@example.com');
  assert.deepEqual(preferences.readUnsubscribeToken(token), { auctionHouseId: 'house', email: 'buyer@example.com' });
  assert.throws(() => preferences.readUnsubscribeToken(token + 'x'), err => err.status === 400);
  await invite();
  await preferences.unsubscribe(token, client);
  assert.equal(state.items.marketingContact[0].subscribed, false);
  assert.equal(state.items.marketingMessage[0].status, 'CANCELLED');
  assert.equal(state.items.marketingSuppression[0].email, 'buyer@example.com');
});

test('deleting and reimporting a contact preserves opt-out; editing cannot resubscribe them', async () => {
  await preferences.unsubscribe(preferences.unsubscribeToken('house', 'buyer@example.com'), client);
  state.items.marketingContact = [];
  const result = await (await api.POST(event({ action: 'save_contacts', contact: { email: 'buyer@example.com' }, consentConfirmed: true, auctionId: 'auction' }))).json();
  assert.equal(result.queued, 0); assert.equal(result.skippedOptOuts, 1);
  const record = state.items.marketingContact[0];
  assert.equal(record.subscribed, false);
  await assert.rejects(api.POST(event({ action: 'edit_contact', contactId: record.id, contact: {}, subscribed: true })), err => err.status === 400);
});

test('cross-house contacts cannot be edited, deleted, invited or disclosed', async () => {
  state.items.marketingContact.push({ id: 'foreign-contact', auctionHouseId: 'foreign', email: 'secret@example.com', subscribed: true });
  await assert.rejects(api.POST(event({ action: 'edit_contact', contactId: 'foreign-contact', contact: {}, subscribed: false })), err => err.status === 404);
  await api.POST(event({ action: 'delete_contact', contactId: 'foreign-contact' }));
  assert.ok(state.items.marketingContact.some(row => row.id === 'foreign-contact'));
  assert.equal((await (await api.POST(event({ action: 'invite', auctionId: 'auction', contactIds: ['foreign-contact'] }))).json()).queued, 0);
  const response = await api.GET(event({}, { query: '?q=secret' }));
  assert.equal((await response.json()).contacts.length, 0);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('auction reminder audience combines enrolled contacts and verified approved bidders once', async () => {
  await invite();
  state.items.auctionRegistration = [{ auctionId: 'auction', userId: 'buyer', status: 'APPROVED' }, { auctionId: 'auction', userId: 'other', status: 'APPROVED' }, { auctionId: 'auction', userId: 'unverified', status: 'APPROVED' }];
  state.items.user.push({ id: 'unverified', email: 'not-verified@example.com' });
  await service.queueCampaignReminders(campaign(), { client });
  await service.queueCampaignReminders(campaign(), { client });
  assert.equal(state.items.marketingMessage.filter(row => row.kind === 'AUCTION_START').length, 2);
});

test('watched-lot reminders follow current/next ready queue, skipping hidden and unverified watchers', async () => {
  Object.assign(state.items.auction[0], { status: 'LIVE', auctioneerStartedAt: new Date(), settings: JSON.stringify({ onBlockLotId: 'current' }) });
  state.items.lot = [
    { id: 'current', auctionId: 'auction', isReady: true, status: 'ACTIVE', position: 1, lotNumber: 1, endTime: new Date(Date.now() + 60000) },
    { id: 'next', auctionId: 'auction', isReady: true, status: 'ACTIVE', position: 2, lotNumber: 2, endTime: null },
    { id: 'hidden', auctionId: 'auction', isReady: false, status: 'ACTIVE', position: 3, lotNumber: 3 }
  ];
  state.items.lotWatch = [{ userId: 'buyer', lotId: 'next' }, { userId: 'other', lotId: 'hidden' }];
  await service.queueCampaignReminders(campaign(), { client });
  await service.queueCampaignReminders(campaign(), { client });
  const reminders = state.items.marketingMessage.filter(row => row.kind === 'LOT_NEXT');
  assert.equal(reminders.length, 1); assert.equal(reminders[0].lotId, 'next');
  const eligible = await service.messageEligibility(joined('marketingMessage', reminders[0]), { client });
  assert.equal(eligible.live, false);
  state.items.lotWatch = [];
  assert.match((await service.messageEligibility(joined('marketingMessage', reminders[0]), { client })).reason, /no longer watched/);
});

test('concurrent delivery workers claim each queued message once', async () => {
  state.items.marketingCampaign[0].auctionReminders = false;
  await invite();
  let sends = 0;
  const sendOnce = async () => { sends++; return send(); };
  await Promise.all([service.processMarketing({ client, send: sendOnce }), service.processMarketing({ client, send: sendOnce })]);
  assert.equal(sends, 1); assert.equal(state.items.marketingMessage[0].status, 'SENT');
});

test('worker suppresses opted-out recipients and cancelled auctions immediately before delivery', async () => {
  state.items.marketingCampaign[0].auctionReminders = false;
  await invite();
  state.items.marketingSuppression = [{ auctionHouseId: 'house', email: 'buyer@example.com' }];
  let sends = 0;
  await service.processMarketing({ client, send: async () => { sends++; return send(); } });
  assert.equal(sends, 0); assert.equal(state.items.marketingMessage[0].status, 'CANCELLED');
  state.items.marketingMessage[0].status = 'QUEUED'; state.items.marketingSuppression = []; state.items.auction[0].status = 'CANCELLED';
  await service.processMarketing({ client, send: async () => { sends++; return send(); } });
  assert.equal(sends, 0); assert.equal(state.items.marketingMessage[0].status, 'CANCELLED');
});

test('uncertain provider delivery is never automatically retried; known rejections can be retried', async () => {
  state.items.marketingCampaign[0].auctionReminders = false;
  await invite();
  const uncertain = new Error('Timeout'); uncertain.status = 502; uncertain.deliveryUncertain = true;
  await service.processMarketing({ client, send: async () => { throw uncertain; } });
  assert.equal(state.items.marketingMessage[0].status, 'UNKNOWN');
  assert.equal((await (await api.POST(event({ action: 'retry', messageId: state.items.marketingMessage[0].id }))).json()).queued, 0);
  state.items.marketingMessage[0].status = 'QUEUED';
  const rejected = new Error('Rejected'); rejected.status = 502; rejected.deliveryUncertain = false;
  await service.processMarketing({ client, send: async () => { throw rejected; } });
  assert.equal(state.items.marketingMessage[0].status, 'FAILED');
  assert.equal((await (await api.POST(event({ action: 'retry', messageId: state.items.marketingMessage[0].id }))).json()).queued, 1);
});

test('stale claimed messages become unconfirmed without resending', async () => {
  state.items.marketingCampaign[0].auctionReminders = false;
  await invite();
  Object.assign(state.items.marketingMessage[0], { status: 'PROCESSING', claimedAt: new Date(Date.now() - 21 * 60000) });
  let sends = 0;
  await service.processMarketing({ client, send: async () => { sends++; return send(); } });
  assert.equal(sends, 0); assert.equal(state.items.marketingMessage[0].status, 'UNKNOWN');
});

test('rescheduling cancels the old start reminder and generates a new event without duplicate sends', async () => {
  await invite(); await service.queueCampaignReminders(campaign(), { client });
  const old = state.items.marketingMessage.find(row => row.kind === 'AUCTION_START');
  state.items.auction[0].startDate = new Date(Date.now() + 10 * 60000);
  assert.match((await service.messageEligibility(joined('marketingMessage', old), { client })).reason, /changed/);
  await service.queueCampaignReminders(campaign(), { client });
  assert.equal(state.items.marketingMessage.filter(row => row.kind === 'AUCTION_START').length, 2);
});

test('update requests are idempotent and templates escape content while including signed opt-out', async () => {
  await invite();
  const body = { action: 'update', auctionId: 'auction', requestId: '01234567-1234-1234-1234-012345678901', subject: '<Update>', message: '<script>alert(1)</script>' };
  assert.equal((await (await api.POST(event(body))).json()).queued, 1);
  assert.equal((await (await api.POST(event(body))).json()).queued, 0);
  const row = state.items.marketingMessage.find(row => row.kind === 'UPDATE');
  const mail = templates.marketingEmail(joined('marketingMessage', row));
  assert.doesNotMatch(mail.html, /<script>/); assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.text, /https:\/\/pumbi.example\/auctions\/auction/);
  assert.match(mail.customHeaders[0].value, /email-preferences\?token=/);
  assert.equal(mail.to, 'buyer@example.com');
});

test('cron rejects normal browser requests before processing messages', async () => {
  const response = await cron.GET({ request: new Request('https://pumbi.example/api/cron/marketing') });
  assert.equal(response.status, 401);
  assert.equal(state.items.marketingMessage.length, 0);
});


test('first ready lot watchers get a pre-start reminder without requiring bidder registration', async () => {
  state.items.auction[0].startDate = new Date(Date.now() + 4 * 60000);
  state.items.lot = [{ id: 'first', auctionId: 'auction', isReady: true, status: 'ACTIVE', position: 1, lotNumber: 1, title: 'First lot', endTime: null }];
  state.items.lotWatch = [{ userId: 'buyer', lotId: 'first' }];
  await service.queueCampaignReminders(campaign(), { client });
  const row = state.items.marketingMessage.find(row => row.kind === 'LOT_NEXT');
  assert.equal(row.lotId, 'first');
  assert.equal((await service.messageEligibility(joined('marketingMessage', row), { client })).lot.id, 'first');
});

test('a cancelled reminder for a reordered lot is queued when it becomes next again', async () => {
  Object.assign(state.items.auction[0], { status: 'LIVE', auctioneerStartedAt: new Date(), settings: JSON.stringify({ onBlockLotId: 'current' }) });
  state.items.lot = [{ id: 'current', auctionId: 'auction', isReady: true, status: 'ACTIVE', endTime: new Date(Date.now() + 60000) }, { id: 'next', auctionId: 'auction', isReady: true, status: 'ACTIVE', endTime: null }];
  state.items.lotWatch = [{ userId: 'buyer', lotId: 'next' }];
  await service.queueCampaignReminders(campaign(), { client });
  const row = state.items.marketingMessage.find(row => row.kind === 'LOT_NEXT');
  Object.assign(row, { status: 'CANCELLED', error: 'Live queue changed' });
  await service.queueCampaignReminders(campaign(), { client });
  assert.equal(row.status, 'QUEUED');
  row.status = 'SENT';
  await service.queueCampaignReminders(campaign(), { client });
  assert.equal(row.status, 'SENT');
});

test('an invitation backlog does not delay a watched-lot reminder', async () => {
  state.items.marketingCampaign[0].auctionReminders = false;
  await invite();
  state.items.marketingMessage.push({ id: 'urgent', auctionHouseId: 'house', campaignId: 'campaign', email: 'other@example.com', recipientUserId: 'other', kind: 'AUCTION_START', eventKey: 'old', status: 'QUEUED', createdAt: new Date() });
  await service.processMarketing({ client, limit: 1, send });
  assert.equal(state.items.marketingMessage[0].status, 'QUEUED');
  assert.equal(state.items.marketingMessage[1].status, 'CANCELLED');
});


test('default invitations describe sign-in bidding for open auctions and registration for gated auctions', async () => {
  await invite();
  const row = state.items.marketingMessage[0];
  const open = templates.marketingEmail(joined('marketingMessage', row));
  assert.match(open.text, /sign in to bid/); assert.match(open.text, /No advance registration or approval is required/);
  state.items.auction[0].settings = JSON.stringify({ requireRegistrationToBid: true });
  const gated = templates.marketingEmail(joined('marketingMessage', row));
  assert.match(gated.text, /register to bid/); assert.doesNotMatch(gated.text, /No advance registration or approval/);
});
