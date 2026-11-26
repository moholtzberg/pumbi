import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const state = (globalThis.__settingsContractTest = {});
const db = {
  $queryRaw: async () => {
    state.locks++;
    return [];
  },
  auction: {
    findUnique: async () => ({ ...state.auction, auctionHouse: state.house }),
    update: async ({ data }) => {
      state.writes++;
      Object.assign(state.auction, data);
      return state.auction;
    },
  },
  auctionHouse: {
    findUnique: async () => state.house,
    update: async ({ data }) => {
      state.writes++;
      Object.assign(state.house, data);
      return state.house;
    },
  },
};
db.$transaction = async (callback) => callback(db);
state.db = db;
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  plugins: [
    {
      name: 'settings-contract-fixtures',
      enforce: 'pre',
      resolveId(id) {
        if (id === '$lib/prisma.js') return '\0settings-db';
        if (id === '$lib/server/authorization.js') return '\0settings-auth';
        if (id === '$lib/zod.js')
          return fileURLToPath(new URL('../src/lib/zod.ts', import.meta.url));
        if (id.startsWith('$lib/'))
          return fileURLToPath(
            new URL('../src/lib/' + id.slice(5), import.meta.url),
          );
      },
      load(id) {
        if (id === '\0settings-db')
          return 'export default globalThis.__settingsContractTest.db;';
        if (id === '\0settings-auth')
          return `export const HOUSE_PERMISSIONS={VIEW:'view',MANAGE_COMPANY:'company',MANAGE_AUCTIONS:'auction'}; export const getAuthenticatedUser=async()=>globalThis.__settingsContractTest.user; export const isPlatformAdmin=u=>u?.role==='PLATFORM_ADMIN'; export const canManageAuctionHouse=(u,id)=>u?.house===id; export const requireAuthenticatedUser=async()=>{const u=globalThis.__settingsContractTest.user;if(!u){const e=new Error('Login');e.status=401;throw e;}return u;}; export const requireAuctionHousePermission=async(u,id)=>{if(u?.house!==id){const e=new Error('Forbidden');e.status=403;throw e;}}; export const requireAuctionAccess=(u,a)=>{if(!a||u?.house!==a.auctionHouseId){const e=new Error('Forbidden');e.status=403;throw e;}};`;
      },
    },
  ],
});
const houseRoute = await server.ssrLoadModule(
  '/src/routes/api/auction-houses/[id]/settings/+server.js',
);
const auctionRoute = await server.ssrLoadModule(
  '/src/routes/api/auctions/[id]/settings/+server.js',
);
const { updateAuctionSettings } = await server.ssrLoadModule(
  '/src/lib/server/auctionSettings.js',
);
const { resolveProxyPrice } = await server.ssrLoadModule(
  '/src/lib/server/proxyBidding.js',
);
const { resolveBuyerPremiumRate, recalculateInvoiceTotals } =
  await server.ssrLoadModule('/src/lib/server/invoices.js');
after(async () => {
  await server.close();
  delete globalThis.__settingsContractTest;
});
beforeEach(() => {
  state.locks = 0;
  state.writes = 0;
  state.user = { id: 'seller', house: 'house', role: 'SELLER' };
  state.house = {
    id: 'house',
    settings: JSON.stringify({
      bidIncrements: [
        { from: 0, increment: 5 },
        { from: 1000, increment: 100 },
      ],
      automaticAuctionInitialTimerSeconds: 90,
      keepLegacy: 'house',
      buyerPaysShipping: false,
    }),
  };
  state.auction = {
    id: 'auction',
    auctionHouseId: 'house',
    type: 'PRIVATE',
    currency: 'ils',
    privateHouseBuyerPremiumRateSnapshot: 0.15,
    settings: JSON.stringify({
      onBlockLotId: 'current',
      autoAdvanceNextLot: true,
      automaticAuctionTimerResetSeconds: 45,
      keepLegacy: 'auction',
      unsoldRelistRoundStartedAt: '2026-11-26T00:00:00Z',
      unsoldRelistCount: 3,
      galleryTemplateSettings: { sliderShowDots: false, minimalGridColumns: 4 },
    }),
  };
});
const event = (body, id = 'auction') => ({
  params: { id },
  locals: {},
  request: new Request('https://pumbi.test/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
});
test('house schedule validates, sorts, locks and preserves unrelated stored settings', async () => {
  await houseRoute.PATCH(
    event(
      {
        bidIncrements: [
          { from: 1000, increment: 100 },
          { from: 0, increment: 5 },
        ],
      },
      'house',
    ),
  );
  const stored = JSON.parse(state.house.settings);
  assert.equal(stored.bidIncrements[0].from, 0);
  assert.equal(stored.keepLegacy, 'house');
  assert.equal(state.locks, 1);
});
test('duplicate, nonpositive and uncovered tier tables cannot be saved', async () => {
  for (const rows of [
    [{ from: 0, increment: 0 }],
    [{ from: 0, increment: -1 }],
    [{ from: 50, increment: 10 }],
    [
      { from: 0, increment: 5 },
      { from: 0, increment: 10 },
    ],
  ])
    await assert.rejects(
      houseRoute.PATCH(event({ bidIncrements: rows }, 'house')),
      (e) => e.status === 400,
    );
  assert.equal(state.writes, 0);
});
test('auction settings patches preserve the floor, relist state, omitted controls, legacy data and nested gallery fields', async () => {
  await auctionRoute.PATCH(
    event({
      bidIncrements: [{ from: 0, increment: 20 }],
      onBlockLotId: 'forged',
      unsoldRelistRoundStartedAt: null,
      unsoldRelistCount: 100,
      galleryTemplateSettings: { minimalGridColumns: 3 },
    }),
  );
  const stored = JSON.parse(state.auction.settings);
  assert.equal(stored.onBlockLotId, 'current');
  assert.equal(stored.autoAdvanceNextLot, true);
  assert.equal(stored.automaticAuctionTimerResetSeconds, 45);
  assert.equal(stored.keepLegacy, 'auction');
  assert.equal(stored.unsoldRelistCount, 3);
  assert.equal(stored.unsoldRelistRoundStartedAt, '2026-11-26T00:00:00Z');
  assert.equal(stored.galleryTemplateSettings.sliderShowDots, false);
  assert.equal(stored.galleryTemplateSettings.minimalGridColumns, 3);
  assert.equal(state.locks, 1);
});
test('untrusted forms cannot create a live floor pointer or change auction currency', async () => {
  const stored = await updateAuctionSettings(
    {},
    {
      onBlockLotId: 'forged',
      unsoldRelistRoundStartedAt: 'forged',
      unsoldRelistCount: 99,
    },
    'ils',
  );
  assert.equal(stored.onBlockLotId, undefined);
  assert.equal(stored.unsoldRelistRoundStartedAt, undefined);
  await assert.rejects(
    auctionRoute.PATCH(event({ currency: 'USD' })),
    (e) => e.status === 409,
  );
  assert.equal(state.writes, 0);
});
test('blank auction timer overrides inherit and schedule override clearing restores the house', async () => {
  await auctionRoute.PATCH(
    event({ automaticAuctionTimerResetSeconds: null, bidIncrements: [] }),
  );
  const result = await (
    await auctionRoute.GET({ params: { id: 'auction' }, locals: {} })
  ).json();
  assert.equal(result.automaticAuctionTimerResetSeconds, null);
  assert.equal(result._inheritance.timers.bidExtensionSeconds, 30);
  assert.equal(result.buyerPaysShipping, undefined);
  assert.equal(result._inheritance.buyerPaysShipping, false);
  assert.equal(result._inheritance.increments.source, 'house');
  assert.equal(result._inheritance.buyerPremium, 15);
});
test('settings access is house-scoped and public responses omit private defaults', async () => {
  state.user = { id: 'other', house: 'other' };
  await assert.rejects(
    houseRoute.PATCH(event({ bidIncrements: [] }, 'house')),
    (e) => e.status === 403,
  );
  await assert.rejects(
    auctionRoute.PATCH(event({ bidIncrements: [] })),
    (e) => e.status === 403,
  );
  state.user = null;
  const result = await (
    await auctionRoute.GET({ params: { id: 'auction' }, locals: {} })
  ).json();
  assert.equal(result._inheritance, undefined);
  assert.equal(result.keepLegacy, undefined);
  assert.equal(state.writes, 0);
});
test('proxy defenses choose the tier at the competing maximum and stay capped by the winning maximum', () => {
  const lot = {
    startingBid: 25,
    currentBid: 25,
    bidIncrement: 5,
    highestBidderId: 'alice',
    auction: { settings: {}, auctionHouse: state.house },
  };
  for (const [alice, bob, expected] of [
    [2000, 1000, 1100],
    [1050, 1000, 1050],
    [1000, 1000, 1000],
    [1000, 950, 955],
  ]) {
    const result = resolveProxyPrice(lot, [
      { userId: 'alice', maxAmount: alice },
      { userId: 'bob', maxAmount: bob },
    ]);
    assert.equal(result.price, expected);
    assert.equal(result.winner.userId, 'alice');
  }
});
test('snapshotted fractional fees are shown and invoiced as percentage points while existing invoices are untouched', () => {
  const rate = resolveBuyerPremiumRate({
    auction: state.auction,
    auctionHouse: { settings: '{"buyersPremium":30}' },
  });
  assert.equal(rate, 15);
  assert.equal(
    recalculateInvoiceTotals({ hammerPrice: 100, buyerPremiumRate: rate })
      .buyerPremiumAmount,
    15,
  );
  assert.equal(
    resolveBuyerPremiumRate({ auction: { buyerPremiumRateSnapshot: 0.12 } }),
    12,
  );
  assert.equal(state.writes, 0);
});
