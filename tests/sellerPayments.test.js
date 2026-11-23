import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// Load the real route and checkout service with isolated database/Stripe adapters.
// No database writes or Stripe network requests are made by these tests.
const state = globalThis.__sellerPaymentTest = {};
const mocks = {
  '$lib/prisma.js': `export default globalThis.__sellerPaymentTest.prisma`,
  '$lib/server/stripe.js': `export function getStripe() { return globalThis.__sellerPaymentTest.stripe; }`,
  '$lib/server/authorization.js': `
    export const HOUSE_PERMISSIONS = { MANAGE_AUCTIONS: 'MANAGE_AUCTIONS' };
    export async function requireAuthenticatedUser() { return globalThis.__sellerPaymentTest.user; }
    export async function requireAuctionHousePermission(user, id) {
      if (user.auctionHouseId !== id) { const error = new Error('Forbidden'); error.status = 403; throw error; }
    }`,
  '$lib/server/shipping.js': `
    export async function purchaseLabelForInvoice() {}
    export async function quoteShippingRates() {}
    export async function selectShippingRate() {}`
};
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  plugins: [{
    name: 'payment-test-adapters',
    resolveId(id) {
      if (mocks[id]) return '\0' + id;
      if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
    },
    load(id) { if (id.startsWith('\0')) return mocks[id.slice(1)]; }
  }]
});
// Keep adapter identities stable: the production modules retain these objects.
state.prisma = {
  invoice: {
    findUnique: async () => structuredClone(state.invoice),
    update: async ({ data }) => {
      state.writes.push(data);
      Object.assign(state.invoice, data);
      return structuredClone(state.invoice);
    }
  }
};
state.stripe = { checkout: { sessions: {
  retrieve: async () => state.session,
  expire: async (id) => { state.expired.push(id); },
  create: async (params) => {
    state.checkout = params;
    return { id: 'cs_new', url: 'https://checkout.stripe.com/test' };
  }
} } };
const { POST } = await server.ssrLoadModule('/src/routes/api/seller/invoices/[id]/+server.js');
const { syncInvoiceCheckoutSession } = await server.ssrLoadModule('/src/lib/server/invoiceCheckout.js');
after(async () => { await server.close(); delete globalThis.__sellerPaymentTest; });
beforeEach(() => {
  state.user = { id: 'seller', auctionHouseId: 'house' };
  state.invoice = {
    id: 'invoice', number: 'INV-1', buyerId: 'buyer', auctionHouseId: 'house', lotId: 'lot',
    status: 'UNPAID', currency: 'usd', totalAmount: 110, hammerPrice: 100,
    buyerPremiumAmount: 10, buyerPremiumRate: 10, shippingAmount: 0, buyerPaysShipping: false,
    lot: { id: 'lot', title: 'Test lot', lotNumber: 1 }, auction: { id: 'auction', title: 'Auction' },
    auctionHouse: { id: 'house', name: 'House', stripeConnectAccountId: 'acct_house', stripeConnectChargesEnabled: true },
    buyer: { id: 'buyer', email: 'buyer@example.com' }, shipment: null, notes: 'Existing note'
  };
  state.session = { id: 'cs_old', status: 'open', payment_status: 'unpaid' };
  state.writes = [];
  state.expired = [];
  state.checkout = null;
});
function record(payload) {
  return POST({ params: { id: 'invoice' }, locals: {}, request: new Request('https://pumbi.test/api/seller/invoices/invoice', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'record_payment', ...payload })
  }) });
}

test('cash records an external payment with seller and notes', async () => {
  const response = await record({ method: 'cash', notes: 'Collected at pickup' });
  assert.equal(response.status, 200);
  assert.equal(state.invoice.status, 'PAID');
  assert.equal(state.invoice.paymentChannel, 'EXTERNAL');
  assert.equal(state.invoice.externalPaymentMethod, 'Cash');
  assert.match(state.invoice.notes, /Existing note\nPayment recorded by seller: Cash · Collected at pickup/);
});

test('check requires a number and preserves it on the invoice', async () => {
  await assert.rejects(record({ method: 'check' }), (err) => err.status === 400);
  assert.equal(state.writes.length, 0);
  await record({ method: 'check', checkNumber: '001234' });
  assert.equal(state.invoice.externalPaymentMethod, 'Check');
  assert.match(state.invoice.notes, /Check #001234/);
});

test('card opens Stripe with buyer email, full amount, house destination and seller return URLs', async () => {
  const response = await record({ method: 'card' });
  assert.equal((await response.json()).url, 'https://checkout.stripe.com/test');
  assert.equal(state.invoice.status, 'PENDING_CHECKOUT');
  assert.equal(state.invoice.paidAt, undefined);
  assert.deepEqual(state.checkout.payment_method_types, ['card']);
  assert.equal(state.checkout.customer_email, 'buyer@example.com');
  assert.equal(state.checkout.success_url, 'https://pumbi.test/seller/sold/invoice?paid=1');
  assert.equal(state.checkout.cancel_url, 'https://pumbi.test/seller/sold/invoice?canceled=1');
  assert.equal(state.checkout.line_items.reduce((sum, item) => sum + item.price_data.unit_amount, 0), 11000);
  assert.equal(state.checkout.payment_intent_data.transfer_data.destination, 'acct_house');
});

test('unauthorized seller cannot record a payment', async () => {
  state.user.auctionHouseId = 'other';
  await assert.rejects(record({ method: 'cash' }), (err) => err.status === 403);
  assert.equal(state.writes.length, 0);
});

test('invalid methods and terminal invoices cannot be paid', async () => {
  await assert.rejects(record({ method: 'wire' }), (err) => err.status === 400);
  for (const status of ['CANCELLED', 'REFUNDED']) {
    state.invoice.status = status;
    await assert.rejects(record({ method: 'cash' }), (err) => err.status === 409);
    await assert.rejects(record({ method: 'card' }), (err) => err.status === 409);
  }
  assert.equal(state.writes.length, 0);
});

test('recording offline payment expires an outstanding Stripe checkout', async () => {
  state.invoice.stripeCheckoutSessionId = 'cs_old';
  await record({ method: 'cash' });
  assert.deepEqual(state.expired, ['cs_old']);
  assert.equal(state.invoice.status, 'PAID');
});

test('already paid invoices are not overwritten or charged again', async () => {
  state.invoice.status = 'PAID';
  state.invoice.externalPaymentMethod = 'Check';
  await record({ method: 'cash' });
  await assert.rejects(record({ method: 'card' }), (err) => err.status === 409);
  assert.equal(state.writes.length, 0);
  assert.equal(state.checkout, null);
});

test('completed but unpaid Stripe session does not mark the invoice paid', async () => {
  await syncInvoiceCheckoutSession({ id: 'cs_old', mode: 'payment', status: 'complete', payment_status: 'unpaid', metadata: { invoiceId: 'invoice' } });
  assert.equal(state.writes.length, 0);
  state.invoice.stripeCheckoutSessionId = 'cs_old';
  state.session.status = 'complete';
  await assert.rejects(record({ method: 'card' }), (err) => err.status === 409);
  await assert.rejects(record({ method: 'cash' }), (err) => err.status === 409);
});

test('confirmed Stripe payment records card channel and payment intent', async () => {
  await syncInvoiceCheckoutSession({ id: 'cs_new', mode: 'payment', payment_status: 'paid', metadata: { invoiceId: 'invoice' }, payment_intent: 'pi_paid' });
  assert.equal(state.invoice.status, 'PAID');
  assert.equal(state.invoice.paymentChannel, 'PUMBI_STRIPE');
  assert.equal(state.invoice.stripePaymentIntentId, 'pi_paid');
});

test('buyer checkout retains its return destination and authorization checks', async () => {
  const { createInvoiceCheckoutSession } = await server.ssrLoadModule('/src/lib/server/invoiceCheckout.js');
  await assert.rejects(createInvoiceCheckoutSession({ invoiceId: 'invoice', origin: 'https://pumbi.test', buyerUser: { id: 'other' } }), (err) => err.status === 403);
  await createInvoiceCheckoutSession({ invoiceId: 'invoice', origin: 'https://pumbi.test', buyerUser: state.invoice.buyer });
  assert.equal(state.checkout.success_url, 'https://pumbi.test/dashboard/invoices/invoice?paid=1');
  assert.equal(state.checkout.payment_method_types, undefined);
});

test('card checkout requires buyer-paid shipping to be selected', async () => {
  state.invoice.buyerPaysShipping = true;
  await assert.rejects(record({ method: 'card' }), (err) => err.status === 409);
  assert.equal(state.checkout, null);
  assert.equal(state.writes.length, 0);
});
