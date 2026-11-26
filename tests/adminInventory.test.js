import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { writable } from 'svelte/store';
import {
  editorFields,
  adminListUrl,
} from '../src/lib/utils/adminManagement.js';
const state = (globalThis.__inventoryTest = {
  page: writable({
    url: new URL('https://pumbi.test/admin/auctions?house=house'),
    data: {},
  }),
});
const db = { user: { findFirst: async () => state.actor } };
for (const key of ['auctionHouse', 'auction', 'lot'])
  db[key] = {
    count: async (args) => {
      state.counts.push({ key, ...args });
      return state.total;
    },
    findMany: async (args) => {
      state.queries.push({ key, ...args });
      return state.rows[key];
    },
    findUnique: async ({ where }) =>
      key === 'auctionHouse'
        ? where.id === 'house'
          ? { id: 'house', name: 'Test house' }
          : null
        : where.id === 'auction'
          ? { id: 'auction', title: 'Private sale', auctionHouseId: 'house' }
          : null,
  };
state.db = db;
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  plugins: [
    {
      name: 'inventory-fixtures',
      enforce: 'pre',
      resolveId(id) {
        if (id === '$lib/prisma.js') return '\0inventory-db';
        if (id === '$app/stores') return '\0inventory-store';
        if (id === '$app/navigation') return '\0inventory-navigation';
        if (id.startsWith('$lib/'))
          return fileURLToPath(
            new URL('../src/lib/' + id.slice(5), import.meta.url),
          );
      },
      load(id) {
        if (id === '\0inventory-db')
          return 'export default globalThis.__inventoryTest.db;';
        if (id === '\0inventory-store')
          return 'export const page=globalThis.__inventoryTest.page;';
        if (id === '\0inventory-navigation')
          return 'export async function invalidateAll(){};';
      },
      transform(source, id) {
        if (id.endsWith('.svelte'))
          return compile(source, { filename: id, generate: 'server' }).js.code;
      },
    },
  ],
});
const { loadAdminInventory } = await server.ssrLoadModule(
  '/src/lib/server/adminInventory.js',
);
const Inventory = (
  await server.ssrLoadModule('/src/lib/components/admin/AdminInventory.svelte')
).default;
after(async () => {
  await server.close();
  delete globalThis.__inventoryTest;
});
beforeEach(() => {
  state.actor = { id: 'admin', role: 'PLATFORM_ADMIN' };
  state.total = 2;
  state.queries = [];
  state.counts = [];
  state.rows = {
    auctionHouse: [
      {
        id: 'house',
        name: 'Test house',
        onboardingStatus: 'APPROVED',
        isActive: true,
        _count: { auctions: 2 },
      },
    ],
    auction: [
      {
        id: 'public',
        title: 'Public sale',
        type: 'PUBLIC',
        status: 'UPCOMING',
        startDate: new Date(),
        currency: 'usd',
        auctionHouse: { id: 'house', name: 'Test house' },
        _count: { lots: 2, registrations: 1 },
      },
      {
        id: 'private',
        title: 'Private sale',
        type: 'PRIVATE',
        status: 'LIVE',
        startDate: new Date(),
        currency: 'ils',
        auctionHouse: { id: 'house', name: 'Test house' },
        _count: { lots: 3, registrations: 0 },
      },
    ],
    lot: [
      {
        id: 'lot',
        title: 'Hebrew book',
        lotNumber: 12,
        status: 'ACTIVE',
        isReady: true,
        currentBid: 100,
        startingBid: 25,
        auction: {
          id: 'auction',
          title: 'Private sale',
          type: 'PRIVATE',
          currency: 'ils',
          auctionHouse: { id: 'house', name: 'Test house' },
        },
        _count: { bids: 2, images: 1 },
      },
    ],
  };
});
const event = (query) => ({
  locals: {
    auth: async () => (state.actor ? { user: { id: 'admin' } } : null),
  },
  url: new URL('https://pumbi.test/admin/auctions' + (query || '')),
});
test('inventory loads authenticate platform admins before reading any inventory', async () => {
  for (const actor of [null, { id: 'seller', role: 'SELLER' }]) {
    state.actor = actor;
    await assert.rejects(loadAdminInventory('auction', event()), (e) =>
      [401, 403].includes(e.status),
    );
  }
  assert.equal(state.counts.length, 0);
  assert.equal(state.queries.length, 0);
});
test('all-auction inventory includes public and private sales with no hidden type restriction', async () => {
  const data = await loadAdminInventory('auction', event());
  assert.equal(data.rows.length, 2);
  assert.equal(state.queries[0].where.type, undefined);
  const html = render(Inventory, { props: { data, kind: 'auction' } }).body;
  assert.match(html, /Public sale/);
  assert.match(html, /Private sale/);
  assert.match(html, /Remove Public sale/);
  assert.match(html, /Remove Private sale/);
  assert.match(html, /\/admin\/lots\?auction=private/);
});
test('house and auction context filters combine and invalid relationships fail clearly', async () => {
  await loadAdminInventory(
    'lot',
    event('?house=house&auction=auction&status=SOLD&q=12'),
  );
  const query = state.queries[0];
  assert.equal(query.where.auctionId, 'auction');
  assert.deepEqual(query.where.auction, { auctionHouseId: 'house' });
  assert.equal(query.where.status, 'SOLD');
  assert.ok(query.where.OR.some((row) => row.lotNumber === 12));
  await assert.rejects(
    loadAdminInventory('lot', event('?house=missing')),
    (e) => e.status === 404,
  );
});
test('status/type/sort filters are validated and pagination is bounded and deterministic', async () => {
  for (const query of ['?status=MADE_UP', '?type=invalid', '?sort=password'])
    await assert.rejects(
      loadAdminInventory('auction', event(query)),
      (e) => e.status === 400,
    );
  state.total = 60;
  const data = await loadAdminInventory(
    'auction',
    event('?house=house&type=PRIVATE&page=999&sort=name'),
  );
  assert.equal(data.page, 3);
  assert.equal(data.pages, 3);
  assert.equal(state.queries[0].skip, 50);
  assert.equal(state.queries[0].where.type, 'PRIVATE');
  assert.equal(state.queries[0].where.auctionHouseId, 'house');
  assert.deepEqual(state.queries[0].orderBy, [{ title: 'asc' }, { id: 'asc' }]);
});
test('house inventory exposes direct edit/remove and scoped child navigation', async () => {
  const data = await loadAdminInventory('auctionHouse', event());
  const html = render(Inventory, {
    props: { data, kind: 'auctionHouse' },
  }).body;
  assert.match(html, /Edit record house/);
  assert.match(html, /Remove Test house/);
  assert.match(html, /\/admin\/auctions\?house=house/);
  assert.match(html, /\/admin\/lots\?house=house/);
});
test('lots show correct auction currency and a simple editor hides technical fields', async () => {
  const data = await loadAdminInventory('lot', event());
  const html = render(Inventory, { props: { data, kind: 'lot' } }).body;
  assert.match(html, /₪/);
  const fields = editorFields(data.model, { simple: true }).map(
    (field) => field.name,
  );
  assert.ok(fields.includes('title'));
  assert.ok(fields.includes('auctionId'));
  assert.ok(!fields.includes('highestBidderId'));
  assert.ok(!fields.includes('currentBid'));
  assert.equal(
    editorFields(data.model, { simple: true, advanced: true }).length,
    data.model.fields.length,
  );
  for (const field of data.model.fields.filter((field) => field.required))
    assert.ok(
      editorFields(data.model, { simple: true, creating: true }).includes(
        field,
      ),
    );
});
test('pagination links preserve search, status and house context', () => {
  const link = adminListUrl(
    '/admin/lots',
    new URLSearchParams('house=house&q=book&status=SOLD&page=1'),
    { page: 2 },
  );
  const url = new URL(link, 'https://pumbi.test');
  assert.equal(url.searchParams.get('house'), 'house');
  assert.equal(url.searchParams.get('q'), 'book');
  assert.equal(url.searchParams.get('status'), 'SOLD');
  assert.equal(url.searchParams.get('page'), '2');
});
