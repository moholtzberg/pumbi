import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const state = globalThis.__emailTest = { env: {}, sent: [], updates: [] };
const prisma = {
  user: { update: async args => { state.updates.push(args); return {}; } },
  contactVerificationCode: {
    findFirst: async () => null, count: async () => 0,
    updateMany: async () => ({}),
    create: async ({ data }) => { state.code = data; return { id: 'code' }; },
    delete: async () => { state.deletedCode = true; }
  }
};
prisma.$transaction = async fn => fn(prisma);
state.prisma = prisma;
state.db = { users: { getByEmail: async () => state.user } };
const originalFetch = globalThis.fetch;
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'email-fixtures', resolveId(id) {
    if (id === '$env/dynamic/private') return '\0email-env';
    if (id === '$lib/prisma.js') return '\0email-prisma';
    if (id === '$lib/db.js') return '\0email-db';
    if (id === '$lib/server/stripe.js') return '\0email-stripe';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0email-env') return 'export const env = globalThis.__emailTest.env;';
    if (id === '\0email-prisma') return 'export default globalThis.__emailTest.prisma;';
    if (id === '\0email-db') return 'export const db = globalThis.__emailTest.db;';
    if (id === '\0email-stripe') return 'export const getStripe = () => {}; export const connectStatusForAccount = () => {};';
  }
}] });
const mail = await server.ssrLoadModule('/src/lib/server/smtp2go.js');
const invites = await server.ssrLoadModule('/src/lib/server/auctionHouseInvitations.js');
const verification = await server.ssrLoadModule('/src/lib/server/verification.js');
const forgot = await server.ssrLoadModule('/src/routes/api/auth/forgot-password/+server.js');
after(async () => { globalThis.fetch = originalFetch; await server.close(); delete globalThis.__emailTest; });
beforeEach(() => {
  for (const key of Object.keys(state.env)) delete state.env[key];
  Object.assign(state.env, { SMTP2GO_API_KEY: 'test-secret', AUTH_SECRET: 'test-otp-secret', APP_URL: 'https://pumbi.example' });
  state.sent = []; state.updates = []; state.deletedCode = false;
  state.user = { id: 'buyer', email: 'buyer@example.com', firstName: '<Alice>', phone: '+12125551234' };
  state.response = { data: { succeeded: 1, failed: 0, failures: [], email_id: 'test-id' } };
  state.status = 200;
  globalThis.fetch = async (url, options) => {
    state.sent.push({ url, ...options, body: JSON.parse(options.body) });
    if (state.networkError) throw new Error('secret provider detail');
    return new Response(JSON.stringify(state.response), { status: state.status });
  };
  state.networkError = false;
});
const message = { to: 'buyer@example.com', subject: 'Test', text: 'Plain text', html: '<p>HTML</p>' };
const invitation = { email: 'staff@example.com', firstName: '<Staff>', auctionHouseName: 'House & Co', role: 'MANAGER', inviteUrl: 'https://pumbi.example/invites/test?x=1&y=2' };
const event = (email = 'buyer@example.com') => ({ url: new URL('https://preview.example/api/auth/forgot-password'), request: new Request('https://preview.example/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }) });

test('SMTP2GO sends text and HTML with server key, requested sender and bounded timeout', async () => {
  await mail.sendTransactionalEmail(message);
  const sent = state.sent[0];
  assert.equal(sent.url, 'https://api.smtp2go.com/v3/email/send');
  assert.equal(sent.headers['X-Smtp2go-Api-Key'], 'test-secret');
  assert.equal(sent.body.sender, 'Pumbi <hello@ginzeyamerica.com>');
  assert.deepEqual(sent.body.to, ['buyer@example.com']);
  assert.equal(sent.body.text_body, message.text);
  assert.equal(sent.body.html_body, message.html);
  assert.equal(sent.body.fastaccept, false);
  assert.ok(sent.signal instanceof AbortSignal);
  state.env.SMTP2GO_FROM_EMAIL = 'Custom <custom@example.com>';
  await mail.sendTransactionalEmail(message);
  assert.equal(state.sent[1].body.sender, state.env.SMTP2GO_FROM_EMAIL);
});

test('missing configuration fails without calling provider; invitations retain manual mode', async () => {
  delete state.env.SMTP2GO_API_KEY;
  await assert.rejects(mail.sendTransactionalEmail(message), err => err.status === 503);
  assert.deepEqual(await invites.deliverAuctionHouseInvitation(invitation), { delivery: 'manual' });
  assert.equal(state.sent.length, 0);
});

test('HTTP and HTTP-200 provider errors, zero acceptance and malformed responses fail closed', async () => {
  for (const [status, response] of [
    [401, { data: { error: 'secret provider detail' } }],
    [200, { data: { error_code: 'DENIED' } }],
    [200, { data: { failed: 1, failures: ['secret recipient'] } }],
    [200, { data: { succeeded: 0 } }], [200, { data: {} }], [200, {}], [200, null]
  ]) {
    state.status = status; state.response = response;
    await assert.rejects(mail.sendTransactionalEmail(message), err => err.status === 502 && !err.body.message.includes('secret'));
  }
});

test('network timeout/errors fail once with no automatic duplicate sends', async () => {
  state.networkError = true;
  await assert.rejects(mail.sendTransactionalEmail(message), err => err.status === 502 && err.deliveryUncertain === true);
  assert.equal(state.sent.length, 1);
});

test('team invitations send through SMTP2GO with escaped HTML and plain-text fallback', async () => {
  assert.deepEqual(await invites.deliverAuctionHouseInvitation(invitation), { delivery: 'sent' });
  assert.match(state.sent[0].body.html_body, /&lt;Staff&gt;/);
  assert.match(state.sent[0].body.html_body, /House &amp; Co/);
  assert.match(state.sent[0].body.text_body, /expires in 7 days/);
  state.response = { data: { error_code: 'DENIED' } };
  await assert.rejects(invites.deliverAuctionHouseInvitation(invitation), err => err.status === 502);
});

test('password reset emails contain the stored one-hour token and canonical site URL', async () => {
  const response = await forgot.POST(event());
  assert.equal(response.status, 200);
  const data = state.updates[0].data;
  assert.match(data.resetPasswordToken, /^[a-f0-9]{64}$/);
  assert.ok(Math.abs(data.resetPasswordExpires.getTime() - Date.now() - 3600000) < 2000);
  const sent = state.sent[0].body;
  const link = new URL(sent.text_body.match(/https:\/\/[^\s]+/)[0]);
  assert.equal(link.origin, 'https://pumbi.example');
  assert.equal(link.pathname, '/auth/reset-password');
  assert.equal(link.searchParams.get('token'), data.resetPasswordToken);
  assert.equal(link.searchParams.get('email'), state.user.email);
  assert.match(sent.html_body, /&lt;Alice&gt;/);
});

test('unknown accounts and failed password-reset delivery return identical public responses', async () => {
  const successful = await (await forgot.POST(event())).json();
  state.user = null;
  const unknown = await (await forgot.POST(event())).json();
  assert.equal(state.sent.length, 1);
  state.user = { id: 'buyer', email: 'buyer@example.com' };
  state.response = { data: { error_code: 'DENIED' } };
  const failed = await (await forgot.POST(event())).json();
  assert.deepEqual(unknown, successful);
  assert.deepEqual(failed, successful);
});

test('verification email uses shared sender and failed delivery cleans up pending OTP', async () => {
  await verification.startContactVerification(state.user, 'email');
  assert.equal(state.sent[0].url, 'https://api.smtp2go.com/v3/email/send');
  assert.match(state.sent[0].body.text_body, /\b\d{6}\b/);
  assert.equal(state.code.channel, 'EMAIL');
  assert.ok(!state.code.codeHash.includes(state.sent[0].body.text_body.match(/\b\d{6}\b/)[0]));
  state.response = { data: { failed: 1 } };
  await assert.rejects(verification.startContactVerification(state.user, 'email'), err => err.status === 502);
  assert.equal(state.deletedCode, true);
});

test('existing SMS verification still uses SMTP2GO SMS endpoint and shared credentials', async () => {
  await verification.startContactVerification(state.user, 'sms');
  assert.equal(state.sent[0].url, 'https://api.smtp2go.com/v3/sms/send');
  assert.deepEqual(state.sent[0].body.destination, ['+12125551234']);
  assert.equal(state.code.channel, 'PHONE');
});
