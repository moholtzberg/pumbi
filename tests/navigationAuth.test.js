import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { writable } from 'svelte/store';

const state = globalThis.__navigationTest = {
  user: null, queries: [],
  page: writable({ url: new URL('https://pumbi.example/dashboard'), data: { navigationUser: null } })
};
const server = await createServer({ configFile: false, ssr: { noExternal: ['@auth/sveltekit'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'navigation-fixtures', enforce: 'pre', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0nav-prisma';
    if (id === '$app/stores') return '\0nav-stores';
    if (id === '$app/environment') return '\0nav-environment';
    if (id === '@auth/sveltekit/client') return '\0nav-auth';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0nav-prisma') return 'export default { user: { findUnique: async args => { const s=globalThis.__navigationTest; s.queries.push(args); return s.user; } } };';
    if (id === '\0nav-stores') return 'export const page = globalThis.__navigationTest.page;';
    if (id === '\0nav-environment') return 'export const browser = false;';
    if (id === '\0nav-auth') return 'export const signOut = async () => {};';
  }, transform(source, id) {
    if (id.endsWith('/Navigation.svelte')) return compile(source, { filename: id, generate: 'server' }).js.code;
  }
}] });
const layout = await server.ssrLoadModule('/src/routes/+layout.server.js');
const Navigation = (await server.ssrLoadModule('/src/lib/components/Navigation.svelte')).default;
after(async () => { await server.close(); delete globalThis.__navigationTest; });
const load = session => layout.load({ locals: { auth: async () => session }, depends: () => {} });
const markup = data => {
  state.page.set({ url: new URL('https://pumbi.example/dashboard'), data });
  return render(Navigation).body;
};

test('menu renders the current server session after guest → sign-in → sign-out transitions', async () => {
  state.queries = [];
  const guest = await load(null);
  assert.match(markup(guest), /class="sign-in(?:\s|")/);
  assert.equal(state.queries.length, 0);

  state.user = { id: 'moshe', name: 'Moshe', email: 'moshe@example.com', role: 'BUYER', auctionHouseId: null, auctionHouseMemberships: [] };
  const signedIn = await load({ user: { email: 'moshe@example.com' } });
  const html = markup(signedIn);
  assert.match(html, /Moshe/);
  assert.doesNotMatch(html, /class="sign-in(?:\s|")/);
  assert.equal(signedIn.navigationUser.hasAuctionHouse, false);
  // Navigation data contains no password, reset tokens, or full membership records.
  assert.deepEqual(Object.keys(signedIn.navigationUser).sort(), ['email', 'hasAuctionHouse', 'id', 'name', 'role']);
  assert.equal(state.queries[0].select.password, undefined);

  const signedOut = await load(null);
  assert.match(markup(signedOut), /class="sign-in(?:\s|")/);
  assert.doesNotMatch(markup(signedOut), /Moshe/);
});

test('menu gets current seller, team-manager and administrator data from database', async () => {
  const session = { user: { email: 'moshe@example.com', role: 'BUYER' } };
  for (const [role, auctionHouseId, memberships, expected] of [
    ['SELLER', 'house', [], true], ['AUCTIONEER', 'house', [], true],
    ['BUYER', null, [{ auctionHouseId: 'house' }], true],
    ['PLATFORM_ADMIN', null, [], false]
  ]) {
    state.user = { id: 'moshe', name: 'Moshe', email: session.user.email, role, auctionHouseId, auctionHouseMemberships: memberships };
    const data = await load(session);
    assert.equal(data.navigationUser.hasAuctionHouse, expected);
    assert.equal(data.navigationUser.role, role);
    assert.equal(state.queries.at(-1).select.auctionHouseMemberships.where.status, 'ACTIVE');
  }
});

test('a deleted user does not retain an account menu from an old JWT', async () => {
  state.user = null;
  assert.equal((await load({ user: { email: 'deleted@example.com' } })).navigationUser, null);
});
