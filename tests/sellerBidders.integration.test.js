import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

async function setup() {
  await import('dotenv/config');
  const { createServer } = await import('vite');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = createRequire(import.meta.url)('@prisma/client');
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  globalThis.__bidderDatabase = { client };
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
    name: 'real-seller-bidder-fixture', enforce: 'pre', resolveId(id) {
      if (id === '$lib/prisma.js') return '\0bidder-database';
      if (id === '$lib/db.js') return '\0bidder-db-empty';
      if (id === '$lib/zod.js') return fileURLToPath(new URL('../src/lib/zod.ts', import.meta.url));
      if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
    }, load(id) {
      if (id === '\0bidder-database') return 'export default new Proxy({}, { get: (_, key) => globalThis.__bidderDatabase.client[key] });';
      if (id === '\0bidder-db-empty') return 'export const db = {};';
    }
  }] });
  return { client, server, close: async () => { await server.close(); await client.$disconnect(); delete globalThis.__bidderDatabase; } };
}
const enabled = process.env.RUN_BIDDER_DATABASE_TESTS === '1';

test('real house profiles isolate history/payments and owner blocks override open bidding', { skip: !enabled }, async () => {
  const { client, server, close } = await setup();
  try {
    const before = await client.bidderBlock.count();
    const rollback = new Error('ROLLBACK_BIDDER_TEST');
    await assert.rejects(client.$transaction(async tx => {
      let savepoint = 0;
      globalThis.__bidderDatabase.client = new Proxy(tx, { get: (target, key) => key === '$transaction' ? async callback => {
        const name = `bidder_test_${++savepoint}`;
        await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
        try { const result = await callback(tx); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`); return result; }
        catch (err) { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`); throw err; }
      } : target[key] });
      const suffix = crypto.randomUUID();
      const house = await tx.auctionHouse.create({ data: { name: 'Profile test house', slug: `profile-${suffix}` } });
      const foreign = await tx.auctionHouse.create({ data: { name: 'Other private house', slug: `other-profile-${suffix}` } });
      const createUser = (name, extra = {}) => tx.user.create({ data: { name, email: `${name.toLowerCase()}-${suffix}@example.invalid`, ...extra } });
      const owner = await createUser('Owner', { role: 'SELLER', auctionHouseId: house.id });
      const otherOwner = await createUser('OtherOwner', { role: 'SELLER', auctionHouseId: foreign.id });
      const manager = await createUser('Manager', { role: 'AUCTIONEER', auctionHouseId: house.id });
      const buyer = await createUser('Buyer', { phone: '+12125551234', address: 'Test address', password: 'PRIVATE_PASSWORD_MUST_NOT_LEAK', stripeCustomerId: `PRIVATE_STRIPE_${suffix}` });
      const challenger = await createUser('Challenger');
      const foreignOnly = await createUser('ForeignOnly');
      await tx.auctionHouseMembership.createMany({ data: [{ auctionHouseId: house.id, userId: owner.id, role: 'OWNER' }, { auctionHouseId: foreign.id, userId: otherOwner.id, role: 'OWNER' }, { auctionHouseId: house.id, userId: manager.id, role: 'AUCTION_MANAGER' }] });
      const createAuction = (targetHouse, seller, title, status = 'ENDED') => tx.auction.create({ data: { title, auctionHouseId: targetHouse.id, sellerId: seller.id, auctioneerId: seller.id, auctioneerStartedAt: new Date(), status, startDate: new Date(Date.now() - 3600000), endDate: new Date(Date.now() + 3600000), settings: JSON.stringify({ requireRegistrationToBid: false }) } });
      const past = await createAuction(house, owner, 'House past auction');
      const live = await createAuction(house, owner, 'House open auction', 'LIVE');
      const otherPast = await createAuction(foreign, otherOwner, 'FOREIGN_HISTORY_MUST_NOT_LEAK');
      const otherLive = await createAuction(foreign, otherOwner, 'Foreign open auction', 'LIVE');
      const createLot = (auction, number, status = 'SOLD', winner = buyer.id) => tx.lot.create({ data: { auctionId: auction.id, title: `Lot ${number}`, lotNumber: number, isReady: true, startingBid: 25, currentBid: status === 'SOLD' ? 100 : 0, bidIncrement: 5, status, highestBidderId: winner, endTime: new Date(Date.now() + 3600000) } });
      const invoiceData = [['PAID','usd','110.10'],['UNPAID','usd','220.20'],['REFUNDED','usd','55.00'],['CANCELLED','usd','66.00'],['AWAITING_EXTERNAL','cad','30.00']];
      for (const [index, [status, currency, totalAmount]] of invoiceData.entries()) {
        const lot = await createLot(past, index + 1);
        await tx.invoice.create({ data: { number: `PROFILE-${suffix}-${index}`, lotId: lot.id, auctionId: past.id, auctionHouseId: house.id, buyerId: buyer.id, status, currency, totalAmount, hammerPrice: 100, paidAt: status === 'PAID' ? new Date() : null, paymentChannel: status === 'PAID' ? 'EXTERNAL' : null, externalPaymentMethod: status === 'PAID' ? 'CASH' : null } });
      }
      await createLot(past, 6); // A real win without an invoice yet.
      const foreignLot = await createLot(otherPast, 1);
      await tx.invoice.create({ data: { number: `FOREIGN-${suffix}`, lotId: foreignLot.id, auctionId: otherPast.id, auctionHouseId: foreign.id, buyerId: buyer.id, status: 'PAID', currency: 'eur', totalAmount: 9999, hammerPrice: 9999 } });
      await tx.auctionRegistration.create({ data: { auctionId: otherPast.id, userId: foreignOnly.id, status: 'APPROVED' } });
      const onBlock = await createLot(live, 1, 'ACTIVE', null);
      const otherBlock = await createLot(otherLive, 1, 'ACTIVE', null);
      const event = (actor, params, body = {}, query = '', method = 'POST') => ({ params, locals: { auth: async () => ({ user: { email: actor.email } }) }, url: new URL(`https://pumbi.test/api/test${query}`), request: new Request('https://pumbi.test/api/test', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
      const bids = await server.ssrLoadModule('/src/routes/api/bids/+server.js');
      const phone = await server.ssrLoadModule('/src/routes/api/auctions/[id]/phone-bids/+server.js');
      const access = await server.ssrLoadModule('/src/routes/api/auctions/[id]/register/+server.js');
      const directory = await server.ssrLoadModule('/src/routes/api/auction-houses/[id]/bidders/+server.js');
      const profiles = await server.ssrLoadModule('/src/routes/api/auction-houses/[id]/bidders/[bidderId]/+server.js');
      const bid = (user, lot, amount) => bids.POST(event(user, {}, { lotId: lot.id, amount }));
      await bid(buyer, onBlock, 150);
      assert.equal(await tx.auctionRegistration.count({ where: { auctionId: live.id, userId: buyer.id } }), 0);
      const roster = await (await directory.GET(event(owner, { id: house.id }, {}, `?auctionId=${live.id}`))).json();
      assert.equal(roster.count, 1); assert.equal(roster.bidders[0].id, buyer.id); assert.equal(roster.canViewProfiles, true);
      const profile = await (await profiles.GET(event(owner, { id: house.id, bidderId: buyer.id }))).json();
      assert.equal(profile.summary.auctionCount, 2); assert.equal(profile.summary.lotsWon, 6); assert.equal(profile.summary.invoiceCount, 5);
      assert.equal(profile.wins.length, 6); assert.equal(profile.wins.filter(lot => !lot.invoice).length, 1);
      const usd = profile.summary.balances.find(row => row.currency === 'USD');
      assert.equal(usd.paid, '110.10'); assert.equal(usd.outstanding, '220.20'); assert.equal(usd.refunded, '55.00'); assert.equal(usd.cancelled, '66.00');
      assert.equal(profile.summary.balances.find(row => row.currency === 'CAD').outstanding, '30.00');
      assert.ok(!JSON.stringify(profile).includes('FOREIGN_')); assert.ok(!JSON.stringify(profile).includes('PRIVATE_'));
      await assert.rejects(profiles.GET(event(manager, { id: house.id, bidderId: buyer.id })), err => err.status === 403);
      await assert.rejects(profiles.GET(event(owner, { id: foreign.id, bidderId: buyer.id })), err => err.status === 403);
      await assert.rejects(profiles.GET(event(owner, { id: house.id, bidderId: foreignOnly.id })), err => err.status === 404);
      const foreignSearch = await (await directory.GET(event(owner, { id: house.id }, {}, '?q=ForeignOnly'))).json();
      assert.equal(foreignSearch.count, 0);
      await profiles.PATCH(event(owner, { id: house.id, bidderId: buyer.id }, { blocked: true, reason: 'Unpaid invoices: internal owner note' }, '', 'PATCH'));
      const ownAccess = await (await access.GET(event(buyer, { id: live.id }))).json();
      assert.equal(ownAccess.blocked, true); assert.equal(ownAccess.readyToBid, false); assert.ok(!JSON.stringify(ownAccess).includes('internal owner note'));
      await assert.rejects(bid(buyer, onBlock, 200), err => err.status === 403);
      await assert.rejects(phone.POST(event(owner, { id: live.id }, { lotId: onBlock.id, mode: 'new', caller: { name: buyer.name, email: buyer.email, phone: buyer.phone }, amount: 200, callerConfirmed: true, acceptedTerms: '' })), err => err.status === 403);
      assert.equal(await tx.auctionRegistration.count({ where: { auctionId: live.id, userId: buyer.id } }), 0);
      const defended = await (await bid(challenger, onBlock, 100)).json();
      assert.equal(defended.currentBid, 30); assert.equal(defended.isLeading, true);
      assert.equal((await (await bid(buyer, otherBlock, 50)).json()).currentBid, 25);
      const blockedRoster = await (await directory.GET(event(owner, { id: house.id }, {}, '?blocked=1'))).json();
      assert.equal(blockedRoster.count, 1); assert.equal(blockedRoster.bidders[0].blocked, true);
      await profiles.PATCH(event(owner, { id: house.id, bidderId: buyer.id }, { blocked: false }, '', 'PATCH'));
      assert.equal((await (await bid(buyer, onBlock, 200)).json()).isLeading, true);
      assert.equal((await tx.bidderBlock.findUnique({ where: { auctionHouseId_userId: { auctionHouseId: house.id, userId: buyer.id } } })).active, false);
      assert.equal(await tx.invoice.count({ where: { auctionHouseId: house.id, buyerId: buyer.id } }), 5);
      throw rollback;
    }, { timeout: 45000 }), err => err === rollback);
    assert.equal(await client.bidderBlock.count(), before);
  } finally { await close(); }
});

test('bidder shared guards allow bids concurrently and serialize block changes without leaking locks', { skip: !enabled }, async () => {
  const { client, server, close } = await setup();
  let release;
  try {
    const { lockHouseBidderAccess } = await server.ssrLoadModule('/src/lib/server/bidderAccess.js');
    const houseId = `guard-test-${crypto.randomUUID()}`;
    let ready;
    const acquired = new Promise(resolve => { ready = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    const first = client.$transaction(async tx => { await lockHouseBidderAccess(tx, houseId); ready(); await held; }, { timeout: 15000 });
    try {
      await acquired;
      await client.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL lock_timeout='300ms'"); await lockHouseBidderAccess(tx, houseId); });
      await assert.rejects(client.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL lock_timeout='300ms'"); await lockHouseBidderAccess(tx, houseId, { exclusive: true }); }), err => /lock timeout/i.test(err.message));
    } finally { release(); await first; }
    await client.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL lock_timeout='1s'"); await lockHouseBidderAccess(tx, houseId, { exclusive: true }); });
  } finally { release?.(); await close(); }
});
