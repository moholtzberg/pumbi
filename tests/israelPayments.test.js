import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const state = globalThis.__israelPaymentsTest = { env: {}, db: {}, stripe: {} };
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'israel-payment-fixtures', enforce: 'pre', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0israel-db';
    if (id === '$env/dynamic/private') return '\0israel-env';
    if (id === '$lib/server/stripe.js') return '\0israel-stripe';
    if (id === '$lib/server/shippo.js') return '\0israel-shippo';
    if (id === '$lib/server/smtp2go.js') return '\0israel-email';
    if (id === '$lib/server/authorization.js') return '\0israel-auth';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0israel-db') return 'export default globalThis.__israelPaymentsTest.db;';
    if (id === '\0israel-env') return 'export const env = globalThis.__israelPaymentsTest.env;';
    if (id === '\0israel-stripe') return 'export const getStripe=()=>globalThis.__israelPaymentsTest.stripe; export const connectStatusForAccount=a=>a.payouts_enabled?"ENABLED":"PENDING";';
    if (id === '\0israel-shippo') return 'export const isShippoConfigured=()=>true; export const createShippoShipment=async args=>{globalThis.__israelPaymentsTest.quote=args; return {objectId:"shipment",rates:[]}}; export const purchaseShippoLabel=()=>{throw new Error("Unexpected label purchase")}; export const mapShippoTrackingStatus=()=>{};';
    if (id === '\0israel-email') return 'export const sendTransactionalEmail=async()=>{}; export const smtp2goRequest=async()=>{};';
    if (id === '\0israel-auth') return 'export const HOUSE_PERMISSIONS={MANAGE_AUCTIONS:"manage"}; export const requireAuctionHousePermission=async()=>{};';
  }
}] });
const verification = await server.ssrLoadModule('/src/lib/server/verification.js');
const shipping = await server.ssrLoadModule('/src/lib/server/shipping.js');
const invoices = await server.ssrLoadModule('/src/lib/server/invoices.js');
const checkout = await server.ssrLoadModule('/src/lib/server/invoiceCheckout.js');
const preferences = await server.ssrLoadModule('/src/routes/api/preferences/+server.js');
after(async () => { await server.close(); delete globalThis.__israelPaymentsTest; });
const user = { id: 'buyer', name: 'משה ישראלי', firstName: 'משה', lastName: 'ישראלי', email: 'buyer@example.invalid', phone: '+972501234567', country: 'IL', preferredLocale: 'he', address: 'הרצל 10, תל אביב 6100001, ישראל' };
beforeEach(() => {
  for (const key of Object.keys(state.env)) delete state.env[key];
  state.created = []; state.links = []; state.writes = []; state.quote = null; state.customer = null;
  state.profile = { id: 'profile', country: 'IL', businessType: 'INDIVIDUAL', contactEmail: user.email, address: user.address };
  state.invoice = { id: 'invoice', number: 'INV-IL', lotId: 'lot', auctionId: 'auction', auctionHouseId: 'house', buyerId: user.id, status: 'UNPAID', currency: 'ils', hammerPrice: 100, buyerPremiumRate: 10, buyerPremiumAmount: 10, totalAmount: 110, shippingAmount: 0, buyerPaysShipping: false, buyer: user, lot: { lotNumber: 1, title: 'ספר' }, auction: { title: 'מכירה', currency: 'ils' }, auctionHouse: { id: 'house', name: 'בית מכירות', country: 'IL', locations: [{ type: 'WAREHOUSE', isPrimary: true, addressLine1: 'יפו 20', city: 'ירושלים', postalCode: '9438302', country: 'IL' }] } };
  state.db.userAddress = { findMany: async () => [] };
  state.db.user = { update: async args => { state.writes.push(args); return user; }, updateMany: async args => { state.writes.push(args); return { count: 1 }; } };
  state.db.sellerProfile = { upsert: async () => state.profile, update: async ({data}) => Object.assign(state.profile, data), updateMany: async () => ({count:1}) };
  state.db.invoice = { findUnique: async () => state.invoice, update: async ({data}) => Object.assign(state.invoice, data), create: async ({data}) => {state.newInvoice=data;return data;} };
  state.db.shipment = { upsert: async ({create}) => ({id:'shipment', ...create}) };
  state.db.lot = { findUnique: async () => ({ id: 'lot', lotNumber:1, status:'SOLD', highestBidderId:user.id, currentBid:100, auction:{ id:'auction', currency:'ils', auctionHouse:{ id:'house', settings:'{"defaultCurrency":"USD"}' } } }) };
  state.stripe.accounts = { create: async params => { state.created.push(params); return {id:'acct'}; }, retrieve: async () => ({ id:'acct', object:'account', country:state.accountCountry || 'IL', details_submitted:false, payouts_enabled:false }) };
  state.stripe.accountLinks = { create: async params => { state.links.push(params);return {url:'https://stripe.example/onboarding'}; } };
  state.stripe.customers = { create: async params => {state.customer=params;return {id:'customer'};} };
  state.stripe.checkout = { sessions: { create: async params => { state.checkout=params;return {id:'checkout',url:'https://stripe.example/checkout'};} } };
  state.accountCountry = 'IL';
});
test('Israeli seller onboarding is explicit about activation and never silently creates a US account', async () => {
  await assert.rejects(verification.startSellerConnect(user, 'https://pumbi.example', 'INDIVIDUAL', 'IL'), err => err.status === 409);
  assert.equal(state.created.length, 0); assert.equal(state.links.length, 0);
});
test('approved Israeli recipient onboarding sends actual country and local details without US tax fields', async () => {
  state.env.STRIPE_ISRAEL_CONNECT_AGREEMENT = 'recipient';
  await verification.startSellerConnect(user, 'https://pumbi.example', 'INDIVIDUAL', 'IL');
  const params = state.created[0];
  assert.equal(params.country, 'IL'); assert.equal(params.tos_acceptance.service_agreement, 'recipient');
  assert.equal(params.individual.address.city, 'תל אביב'); assert.equal(params.individual.address.country, 'IL');
  assert.equal(params.individual.email, user.email); assert.equal(params.individual.id_number, undefined);
  assert.equal(state.links.length, 1);
});
test('existing connected country cannot be changed to another payout jurisdiction', async () => {
  state.profile.stripeConnectAccountId = 'existing'; state.profile.country = 'US';
  await assert.rejects(verification.startSellerConnect(user, 'https://pumbi.example', 'INDIVIDUAL', 'IL'), err => err.status === 409);
  assert.equal(state.created.length, 0); assert.equal(state.links.length, 0);
});
test('ILS invoice amounts reach Stripe unchanged in agorot and no unsupported Hebrew locale is sent', async () => {
  await checkout.createInvoiceCheckoutSession({ invoiceId:'invoice', origin:'https://pumbi.example', buyerUser:user });
  assert.equal(state.checkout.line_items[0].price_data.currency, 'ils');
  assert.equal(state.checkout.line_items[0].price_data.unit_amount, 10000);
  assert.equal(state.checkout.line_items[1].price_data.unit_amount, 1000);
  assert.equal(state.checkout.locale, 'auto'); assert.equal(state.checkout.billing_address_collection, 'required');
});
test('new invoices use the auction currency even when house defaults were changed later', async () => {
  state.db.invoice.findUnique = async () => null;
  await invoices.createInvoiceForSoldLot('lot');
  assert.equal(state.newInvoice.currency, 'ils');
});
test('Israeli shipping accepts no state and preserves Hebrew destination and genuine Israeli origin', async () => {
  await shipping.quoteShippingRates({ invoiceId:'invoice', addressTo:{name:user.name, street1:'הרצל 10',city:'תל אביב',zip:'6100001',country:'IL'} });
  assert.equal(state.quote.addressTo.state, undefined); assert.equal(state.quote.addressTo.country, 'IL');
  assert.equal(state.quote.addressFrom.street1, 'יפו 20'); assert.equal(state.quote.addressFrom.state, '');
});
test('shipping cannot add a dollar rate to a shekel invoice', async () => {
  state.invoice.buyerPaysShipping = true; state.invoice.shipment = {ratesJson:[{objectId:'rate',amount:20,currency:'USD'}]};
  await assert.rejects(shipping.selectShippingRate({invoiceId:'invoice',rateId:'rate'}), err => err.status === 409 && /currency/.test(err.message));
});
test('language preferences persist for guests and accounts without changing verification or country implicitly', async () => {
  const cookies=[];
  const event = email => ({ request: new Request('https://pumbi.example/api/preferences', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale:'he'})}), locals:{auth:async()=>email?{user:{email}}:null},cookies:{set:(...args)=>cookies.push(args)},url:new URL('https://pumbi.example') });
  await preferences.POST(event(null)); assert.equal(state.writes.length,0); assert.equal(cookies[0][1],'he'); assert.equal(cookies[0][2].httpOnly,true);
  await preferences.POST(event(user.email)); assert.deepEqual(state.writes[0].data,{preferredLocale:'he'});
});
