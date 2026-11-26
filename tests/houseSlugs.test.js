import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { writable } from 'svelte/store';
import {
  normalizeHouseSlug,
  houseSlugProblem,
  generateHouseSlug,
  publicHousePath,
  RESERVED_HOUSE_SLUGS,
} from '../src/lib/utils/houseSlugs.js';
const state = (globalThis.__houseSlugTest = {
  page: writable({ data: { locale: 'en' } }),
});
state.db = {
  auctionHouse: {
    findUnique: async ({ where }) => {
      state.lookups++;
      return state.house?.slug === where.slug ? state.house : null;
    },
    findFirst: async () => {
      state.lookups++;
      return state.legacy ? state.house : null;
    },
  },
  auction: {
    count: async ({ where }) => {
      state.where = where;
      return state.total;
    },
    findMany: async (args) => {
      state.query = args;
      return state.auctions;
    },
  },
};
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  plugins: [
    {
      name: 'house-slug-fixtures',
      enforce: 'pre',
      resolveId(id) {
        if (id === '$lib/prisma.js') return '\0slug-db';
        if (id === '$lib/utils/s3Presigned.js') return '\0slug-images';
        if (id === '$app/stores') return '\0slug-stores';
        if (id === '$lib/zod.js')
          return fileURLToPath(new URL('../src/lib/zod.ts', import.meta.url));
        if (id.startsWith('$lib/'))
          return fileURLToPath(
            new URL('../src/lib/' + id.slice(5), import.meta.url),
          );
      },
      load(id) {
        if (id === '\0slug-db')
          return 'export default globalThis.__houseSlugTest.db;';
        if (id === '\0slug-images')
          return 'export const convertToPresignedUrl=async value=>value;';
        if (id === '\0slug-stores')
          return 'export const page=globalThis.__houseSlugTest.page;';
      },
      transform(source, id) {
        if (id.endsWith('.svelte'))
          return compile(source, { filename: id, generate: 'server' }).js.code;
      },
    },
  ],
});
const storefront = await server.ssrLoadModule(
  '/src/routes/[slug]/+page.server.js',
);
const alias = await server.ssrLoadModule(
  '/src/routes/auction-houses/[slug]/+page.server.js',
);
const page = (await server.ssrLoadModule('/src/routes/[slug]/+page.svelte'))
  .default;
const { auctionHouseSignupSchema } =
  await server.ssrLoadModule('/src/lib/zod.ts');
const admin = await server.ssrLoadModule('/src/lib/server/adminData.js');
after(async () => {
  await server.close();
  delete globalThis.__houseSlugTest;
});
beforeEach(() => {
  state.lookups = 0;
  state.legacy = false;
  state.total = 1;
  state.house = {
    id: 'house',
    name: 'Heritage Judaica',
    slug: 'heritage-judaica',
    isActive: true,
    onboardingStatus: 'APPROVED',
    description: 'Rare books',
    contactEmail: 'office@example.invalid',
    contactPhone: '+972501234567',
    settings: '{"addressInEnglish":"100 House St","smtpApiKey":"PRIVATE_KEY"}',
    stripeConnectAccountId: 'PRIVATE_ACCOUNT',
    website: 'https://example.invalid',
    locations: [],
  };
  state.auctions = [
    {
      id: 'sale',
      title: 'Winter sale',
      description: 'Books and silver',
      status: 'UPCOMING',
      currency: 'ils',
      startDate: new Date('2026-12-15T19:00:00Z'),
      endDate: new Date('2026-12-15T23:00:00Z'),
      _count: { lots: 3 },
    },
  ];
  state.page.set({ data: { locale: 'en' } });
});
const event = (slug = 'heritage-judaica', query = '') => ({
  params: { slug },
  url: new URL(`https://pumbi.test/${slug}${query}`),
});
test('slug generation follows a progressively typed name, supports accents, and avoids reserved routes', () => {
  assert.equal(generateHouseSlug('H'), 'h');
  assert.equal(generateHouseSlug('Heritage'), 'heritage');
  assert.equal(generateHouseSlug('Heritage Judaica'), 'heritage-judaica');
  assert.equal(generateHouseSlug('Café  Auctions!'), 'cafe-auctions');
  assert.equal(generateHouseSlug('Admin'), 'admin-house');
  assert.equal(normalizeHouseSlug(' Heritage-Judaica '), 'heritage-judaica');
  assert.equal(publicHousePath('Heritage-Judaica'), '/heritage-judaica');
  for (const slug of RESERVED_HOUSE_SLUGS) assert.ok(houseSlugProblem(slug));
  for (const slug of [
    '',
    'ab',
    '-bad',
    'bad-',
    'bad--slug',
    'bad/slug',
    'a'.repeat(51),
  ])
    assert.ok(houseSlugProblem(slug));
  assert.equal(houseSlugProblem('heritage-judaica'), null);
});
test('signup and platform admin saves normalize slugs and reject reserved or invalid addresses', async () => {
  const parsed = auctionHouseSignupSchema.parse({
    name: 'Heritage',
    slug: ' Heritage-Judaica ',
  });
  assert.equal(parsed.slug, 'heritage-judaica');
  const data = await admin.parseAdminData(admin.modelFor('auctionHouse'), {
    slug: ' Heritage-Judaica ',
  });
  assert.equal(data.slug, 'heritage-judaica');
  for (const slug of ['admin', 'auctions', 'bad--slug']) {
    assert.equal(
      auctionHouseSignupSchema.safeParse({ name: 'Heritage', slug }).success,
      false,
    );
    await assert.rejects(
      admin.parseAdminData(admin.modelFor('auctionHouse'), { slug }),
      (e) => e.status === 400,
    );
  }
});
test('public root slug renders only its house catalog with sanitized contact information', async () => {
  const data = await storefront.load(event());
  assert.equal(data.house.name, 'Heritage Judaica');
  assert.equal(data.canonical, 'https://pumbi.test/heritage-judaica');
  assert.equal(state.where.auctionHouseId, 'house');
  assert.deepEqual(state.where.status.in, ['UPCOMING', 'LIVE']);
  assert.equal(data.auctions[0].lotCount, 3);
  assert.equal(state.query.select._count.select.lots.where.isReady, true);
  assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
  const html = render(page, { props: { data } }).body;
  assert.match(html, /Heritage Judaica/);
  assert.match(html, /\/auctions\/sale/);
  assert.match(html, /office@example.invalid/);
  assert.match(html, /ILS/);
});
test('inactive, unapproved and unknown houses stay unavailable publicly', async () => {
  state.house.isActive = false;
  await assert.rejects(storefront.load(event()), (e) => e.status === 404);
  state.house.isActive = true;
  state.house.onboardingStatus = 'DRAFT';
  await assert.rejects(storefront.load(event()), (e) => e.status === 404);
  state.house = null;
  await assert.rejects(storefront.load(event()), (e) => e.status === 404);
});
test('mixed-case legacy records resolve to a lowercase canonical address without changing stored data', async () => {
  state.house.slug = 'Heritage-Judaica';
  state.legacy = true;
  await assert.rejects(
    storefront.load(event('Heritage-Judaica', '?status=past')),
    (e) => e.status === 308 && e.location === '/heritage-judaica?status=past',
  );
  const data = await storefront.load(event());
  assert.equal(data.house.slug, 'heritage-judaica');
  assert.equal(state.house.slug, 'Heritage-Judaica');
});
test('reserved root routes are never resolved as storefronts and alias redirects preserve filters', async () => {
  await assert.rejects(
    storefront.load(event('admin')),
    (e) => e.status === 404,
  );
  assert.equal(state.lookups, 0);
  assert.throws(
    () =>
      alias.load({
        params: { slug: 'Heritage-Judaica' },
        url: new URL(
          'https://pumbi.test/auction-houses/Heritage-Judaica?status=past',
        ),
      }),
    (e) => e.status === 308 && e.location === '/heritage-judaica?status=past',
  );
});
test('past catalogs, bounded pagination, empty states and Hebrew rendering work', async () => {
  state.total = 25;
  const data = await storefront.load(
    event('heritage-judaica', '?status=past&page=999'),
  );
  assert.equal(data.page, 3);
  assert.equal(state.query.skip, 24);
  assert.deepEqual(state.where.status.in, ['ENDED']);
  state.auctions = [];
  state.total = 0;
  const empty = await storefront.load(event());
  state.page.set({ data: { locale: 'he' } });
  const html = render(page, { props: { data: empty } }).body;
  assert.match(html, /בית מכירות/);
  assert.match(html, /אין כרגע מכירות/);
});
test('invalid external website schemes and malformed legacy settings cannot break or script the page', async () => {
  state.house.website = 'javascript:alert(1)';
  state.house.settings = 'null';
  const data = await storefront.load(event());
  assert.equal(data.house.website, null);
  assert.equal(data.house.address, '');
});
