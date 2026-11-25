import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const state = globalThis.__invoiceEmailTest = { env: {} };
const originalFetch = globalThis.fetch;
state.prisma = { invoice: { findUnique: async ({ where }) => where.id === state.invoice.id ? structuredClone(state.invoice) : null, update: async args => { state.writes.push(args); } } };
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'invoice-email-fixtures', enforce: 'pre', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0invoice-email-db';
    if (id === '$env/dynamic/private') return '\0invoice-email-env';
    if (id === '$lib/server/authorization.js') return '\0invoice-email-auth';
    if (id === '$lib/server/stripe.js') return '\0invoice-email-stripe';
    if (id === '$lib/server/shipping.js') return '\0invoice-email-shipping';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0invoice-email-db') return 'export default globalThis.__invoiceEmailTest.prisma;';
    if (id === '\0invoice-email-env') return 'export const env = globalThis.__invoiceEmailTest.env;';
    if (id === '\0invoice-email-auth') return `export const HOUSE_PERMISSIONS={MANAGE_AUCTIONS:'MANAGE_AUCTIONS'}; export async function requireAuthenticatedUser(locals){ if(!locals.user) {const e=new Error('Login required');e.status=401;throw e;} return locals.user; } export async function requireAuctionHousePermission(user,id){if(user.houseId!==id){const e=new Error('Denied');e.status=403;throw e;}}`;
    if (id === '\0invoice-email-stripe') return 'export function getStripe(){throw new Error("Invoice emails must not start card checkout");}';
    if (id === '\0invoice-email-shipping') return 'export function purchaseLabelForInvoice(){throw new Error("Unexpected label purchase");} export function quoteShippingRates(){} export function selectShippingRate(){}';
  }
}] });
const route = await server.ssrLoadModule('/src/routes/api/seller/invoices/[id]/+server.js');
after(async () => { globalThis.fetch = originalFetch; await server.close(); delete globalThis.__invoiceEmailTest; });
beforeEach(() => {
  for (const key of Object.keys(state.env)) delete state.env[key];
  Object.assign(state.env, { SMTP2GO_API_KEY: 'fake-test-key', APP_URL: 'https://pumbi.example' });
  state.invoice = { id: 'invoice', number: 'INV-42', auctionHouseId: 'house', status: 'UNPAID', currency: 'usd', hammerPrice: 100, buyerPremiumAmount: 10, shippingAmount: 5, totalAmount: 115, buyerPaysShipping: false, lot: { lotNumber: 42, title: '<Silver cup>' }, auction: { title: 'Winter auction' }, auctionHouse: { name: 'House & Co' }, buyer: { name: '<Moshe>', email: 'buyer@example.com' } };
  state.sent = []; state.writes = []; state.failure = null;
  globalThis.fetch = async (url, options) => {
    state.sent.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    if (state.failure === 'network') throw new Error('Timed out');
    return new Response(JSON.stringify(state.failure || { data: { succeeded: 1, failed: 0, email_id: 'mock-id' } }), { status: 200 });
  };
});
const event = (user = { id: 'seller', houseId: 'house' }, id = 'invoice') => ({ params: { id }, locals: { user }, request: new Request(`https://preview.example/api/seller/invoices/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_invoice', email: 'attacker@example.com' }) }) });

test('send invoice emails the recorded buyer with itemized totals and the protected invoice link', async () => {
  const before = structuredClone(state.invoice);
  const response = await route.POST(event());
  assert.deepEqual(await response.json(), { sent: true, sentTo: 'buyer@example.com' });
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const mail = state.sent[0];
  assert.equal(mail.url, 'https://api.smtp2go.com/v3/email/send');
  assert.deepEqual(mail.body.to, ['buyer@example.com']);
  assert.match(mail.body.subject, /INV-42/);
  assert.match(mail.body.text_body, /Hammer price: \$100.00/);
  assert.match(mail.body.text_body, /Buyer premium: \$10.00/);
  assert.match(mail.body.text_body, /Invoice total: \$115.00/);
  assert.match(mail.body.text_body, /https:\/\/pumbi.example\/dashboard\/invoices\/invoice/);
  assert.match(mail.body.html_body, /&lt;Moshe&gt;/); assert.match(mail.body.html_body, /&lt;Silver cup&gt;/);
  assert.deepEqual(state.invoice, before); assert.equal(state.writes.length, 0);
});

test('invoice email requires authentication and permission for that invoice house', async () => {
  await assert.rejects(route.POST(event(null)), err => err.status === 401);
  await assert.rejects(route.POST(event({ id: 'other-seller', houseId: 'foreign' })), err => err.status === 403);
  await assert.rejects(route.POST(event(undefined, 'missing')), err => err.status === 404);
  assert.equal(state.sent.length, 0);
});

test('missing buyer email and missing mail configuration report errors without altering payment', async () => {
  state.invoice.buyer.email = '';
  await assert.rejects(route.POST(event()), err => err.status === 409);
  state.invoice.buyer.email = 'buyer@example.com'; delete state.env.SMTP2GO_API_KEY;
  await assert.rejects(route.POST(event()), err => err.status === 503);
  assert.equal(state.sent.length, 0); assert.equal(state.writes.length, 0); assert.equal(state.invoice.status, 'UNPAID');
});

test('provider rejection or uncertain delivery does not claim success or record a payment', async () => {
  state.failure = { data: { succeeded: 0, failed: 1, failures: ['Rejected'] } };
  await assert.rejects(route.POST(event()), err => err.status === 502);
  state.failure = 'network';
  await assert.rejects(route.POST(event()), err => err.status === 502 && err.deliveryUncertain);
  assert.equal(state.sent.length, 2); assert.equal(state.writes.length, 0); assert.equal(state.invoice.status, 'UNPAID');
});

test('sending a paid, cancelled or refunded invoice sends a copy without requesting another payment', async () => {
  for (const status of ['PAID','CANCELLED','REFUNDED']) {
    state.invoice.status = status;
    await route.POST(event());
    const mail = state.sent.at(-1).body;
    assert.match(mail.text_body, /This is a copy of your invoice/);
    assert.doesNotMatch(mail.html_body, /View invoice &amp; payment options/);
    assert.equal(state.invoice.status, status);
  }
  assert.equal(state.writes.length, 0);
});

test('unselected buyer-paid shipping is disclosed as pending instead of free shipping', async () => {
  state.invoice.buyerPaysShipping = true; state.invoice.shippingAmount = 0;
  await route.POST(event());
  assert.match(state.sent[0].body.text_body, /Shipping: calculated when you choose/);
  assert.match(state.sent[0].body.text_body, /Current total before shipping/);
});
