import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { compile, parse } from 'svelte/compiler';
import { render } from 'svelte/server';
import { writable } from 'svelte/store';
import { translate, hasHebrewTranslation } from '../src/lib/i18n.js';
import heUi from '../src/lib/locales/he-ui.js';
import heAdmin from '../src/lib/locales/he-admin.js';
import { parseAdminSchema } from '../src/lib/utils/adminSchema.js';
const state = globalThis.__i18nUiTest = { page: writable({ data: { locale: 'en' }, url: new URL('https://pumbi.example/'), params: {} }) };
const server = await createServer({
  configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true },
  plugins: [{
    name: 'i18n-ui-fixtures', enforce: 'pre',
    resolveId(id) {
      if (id === '$app/stores') return '\0i18n-stores';
      if (id === '$app/navigation') return '\0i18n-navigation';
      if (id === '$app/environment') return '\0i18n-environment';
      if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
    },
    load(id) {
      if (id === '\0i18n-stores') return 'export const page = globalThis.__i18nUiTest.page;';
      if (id === '\0i18n-navigation') return 'export const invalidateAll=async()=>{}; export const goto=async()=>{};';
      if (id === '\0i18n-environment') return 'export const browser=false; export const dev=false; export const building=false;';
    },
    transform(source, id) { if (id.endsWith('.svelte')) return compile(source, { filename: id, generate: 'server' }).js.code; }
  }]
});
after(async () => { await server.close(); delete globalThis.__i18nUiTest; });
async function html(path, props, locale = 'he') {
  state.page.set({ data: { locale }, url: new URL('https://pumbi.example/'), params: {} });
  return render((await server.ssrLoadModule('/src/' + path)).default, { props }).body;
}
const models = parseAdminSchema(fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'));

test('Hebrew copy preserves interpolation, unknown content, English, and safe object keys', () => {
  assert.equal(translate('he', 'Bid {value0}', { value0: '₪100' }), 'הצעה בסך ₪100');
  assert.equal(translate('en', 'Bid {value0}', { value0: '$100' }), 'Bid $100');
  assert.equal(translate('he', '  RECORD   PAYMENT '), 'רישום תשלום');
  for (const value of ['constructor', '__proto__', 'My English Silver Collection', 'Moshe']) assert.equal(translate('he', value), value);
  assert.equal(translate('he', null), null);
  for (const [key, value] of Object.entries({ ...heUi, ...heAdmin })) {
    assert.equal(typeof value, 'string', key);
    assert.ok(value.length > 0, key);
    const slots = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(slots(value), slots(key), `Interpolation changed: ${key}`);
  }
});

test('all generated admin collection, field and enum labels have Hebrew copy without changing schema keys', () => {
  for (const model of models) {
    assert.ok(hasHebrewTranslation(model.label), model.label);
    for (const field of model.fields) {
      assert.ok(hasHebrewTranslation(field.label), `${model.name}.${field.label}`);
      for (const value of field.values || []) assert.ok(hasHebrewTranslation(value.replaceAll('_', ' ')), value);
    }
  }
});

test('marketplace translates page headings, filters and search while preserving catalog titles and house names', async () => {
  const props = { data: {
    mostWatchedLots: [{ id: 'lot', title: 'Save', watchersCount: 2, bidCount: 1, startingBid: 100,
      auction: { title: 'English Auction Title', currency: 'ils', auctionHouse: { name: 'My English House' } } }],
    mostActiveLots: [], popularAuctions: []
  } };
  const he = await html('routes/+page.svelte', props);
  assert.match(he, /גלו את הפריטים שכולם מדברים עליהם/);
  assert.match(he, /חיפוש מכירות או בתי מכירות/);
  assert.match(he, /הכול/); assert.match(he, /בקרוב/); assert.match(he, /₪/);
  assert.match(he, />Save</); assert.match(he, /English Auction Title/); assert.match(he, /My English House/);
  assert.doesNotMatch(he, /Find the lots everyone is talking about|Search auctions or auction houses/);
  const en = await html('routes/+page.svelte', props, 'en');
  assert.match(en, /Find the lots everyone is talking about/); assert.match(en, /Search auctions or auction houses/);
});

test('buyer dashboard translates setup tasks, payment actions and status without translating a buyer name or invoice ids', async () => {
  const props = { data: {
    user: { id: 'buyer', firstName: 'Moshe' }, watchedLots: [], leadingLots: [], recentBids: [], controlRoomAuctions: [],
    stats: { totalBids: 0, leadingBids: 0, wonBids: 1, wonValueByCurrency: { ils: 100 } },
    wonLots: [{ id: 'lot', title: 'Original English Lot', lotNumber: 1, currentBid: 100,
      auction: { title: 'My English Auction', currency: 'ils' }, invoice: { id: 'invoice-123', status: 'AWAITING_EXTERNAL', totalAmount: 100, currency: 'ils' } }]
  } };
  const he = await html('routes/dashboard/+page.svelte', props);
  for (const text of ['Moshe', 'Original English Lot', 'הוספת שם המשפחה שלכם', 'אימות הדוא״ל שלכם', 'תשלום חשבונית', 'ממתין לתשלום חיצוני', '/dashboard/invoices/invoice-123']) assert.ok(he.includes(text), text);
  assert.doesNotMatch(he, /Add your last name|Pay invoice|AWAITING_EXTERNAL/);
});

test('settings, activity counters and payment controls translate interface labels while retaining form option values', async () => {
  const settings = await html('lib/components/settings/SettingsFields.svelte', {
    values: { currency: 'ILS' }, fields: [{ key: 'currency', label: 'Currency for new auctions', type: 'select',
      help: 'Existing auction and invoice currencies stay fixed.', options: [{ value: 'ILS', label: 'ILS · Israeli shekel ₪' }] }]
  });
  assert.match(settings, /מטבע למכירות חדשות/); assert.match(settings, /שקל חדש/); assert.match(settings, /value="ILS"/);
  const activity = await html('lib/components/AuctionActivity.svelte', { auctionId: 'auction' });
  for (const text of ['נוכחים בחדר', 'מציעים כעת', 'סך ההצעות']) assert.ok(activity.includes(text), text);
  const payment = await html('lib/components/RecordPayment.svelte', { invoice: { id: 'invoice', status: 'UNPAID', currency: 'ILS', totalAmount: 100 } });
  assert.match(payment, /רישום תשלום/); assert.doesNotMatch(payment, />Record payment</);
});

test('admin inventory translates headings, statuses and search; house records remain as entered', async () => {
  const result = await html('lib/components/admin/AdminInventory.svelte', { kind: 'auctionHouse', data: {
    rows: [{ id: 'house', name: 'Save', slug: 'save-house', isActive: true, onboardingStatus: 'APPROVED',
      createdAt: '2026-11-26T10:00:00Z', contactEmail: 'test@example.com', _count: { auctions: 2, members: 1 } }],
    context: {}, total: 1, page: 1, pageSize: 25, statuses: ['APPROVED', 'DRAFT'], sort: 'newest',
    filters: { q: '', status: '', type: '', house: '', auction: '' }
  } });
  assert.match(result, /בתי מכירות/); assert.match(result, /מאושר/); assert.match(result, /חיפוש שם/);
  assert.match(result, />Save</); assert.match(result, /value="APPROVED"/); assert.match(result, /href="\/save-house"/);
});

test('Hebrew fonts use the system serif stack and visible static page copy cannot bypass localization', () => {
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(css, /--pumbi-hebrew-serif: David, 'Times New Roman', Times, serif/);
  assert.match(css, /--pumbi-serif: var\(--pumbi-hebrew-serif\)/);
  assert.doesNotMatch(css, /font-family: 'Heebo'/);
  const allowed = new Set(['Pumbi', '| Pumbi', 'Stripe', 'Stripe Global Payouts', 'px', '/api/test-db', 'Language / שפה', 'English']);
  const files = execFileSync('rg', ['--files', 'src/routes', 'src/lib/components', '-g', '*.svelte'], { encoding: 'utf8' }).trim().split('\n');
  for (const file of files) {
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (node.type === 'Text') {
        const text = node.data.trim().replace(/\s+/g, ' ');
        if (/[A-Za-z]{2}/.test(text) && !text.startsWith('/*')) assert.ok(allowed.has(text), `${file}: ${text}`);
      }
      if (node.type === 'Attribute' || node.type === 'ExpressionTag') return;
      for (const [key, value] of Object.entries(node)) if (!['loc', 'metadata', 'expression'].includes(key)) walk(value);
    }
    walk(parse(fs.readFileSync(file, 'utf8'), { modern: true }).fragment);
  }
});
