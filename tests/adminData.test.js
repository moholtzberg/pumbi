import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { comparePassword } from '../src/lib/utils/password.js';
import { parseAdminSchema, serializeAdminValue } from '../src/lib/utils/adminSchema.js';

const { Prisma } = createRequire(import.meta.url)('@prisma/client');
const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const catalog = parseAdminSchema(schema);
const state = globalThis.__adminDataTest = {};
function select(row, fields) { return fields ? Object.fromEntries(Object.keys(fields).map(key => [key, row[key]])) : { ...row }; }
const client = {};
for (const model of catalog) client[model.key] = {
  findFirst: async () => state.actor,
  findUnique: async ({ where, select: fields }) => {
    const row = state.rows[model.key]?.find(row => row.id === where.id);
    return row ? select(row, fields) : null;
  },
  findMany: async args => { state.lastList = args; return (state.rows[model.key] || []).map(row => select(row, args.select)); },
  count: async ({ where } = {}) => (state.rows[model.key] || []).filter(row => !where?.role || row.role === where.role).length,
  create: async ({ data, select: fields }) => {
    const row = { id: 'new-id', ...data }; state.rows[model.key] ||= []; state.rows[model.key].push(row); state.writes++;
    return select(row, fields);
  },
  update: async ({ where, data, select: fields }) => {
    const row = state.rows[model.key].find(row => row.id === where.id); Object.assign(row, data); state.writes++;
    return select(row, fields);
  },
  delete: async ({ where }) => { state.rows[model.key] = state.rows[model.key].filter(row => row.id !== where.id); state.writes++; }
};
client.$transaction = async callback => callback(client);
client.$queryRaw = async () => [];
state.client = client;
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'admin-data-test-adapters', resolveId(id) {
    if (id === '$lib/prisma.js') return '\0admin-test-prisma';
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) { if (id === '\0admin-test-prisma') return 'export default globalThis.__adminDataTest.client;'; }
}] });
const service = await server.ssrLoadModule('/src/lib/server/adminData.js');
const collection = await server.ssrLoadModule('/src/routes/api/admin/data/[model]/+server.js');
const recordRoute = await server.ssrLoadModule('/src/routes/api/admin/data/[model]/[id]/+server.js');
after(async () => { await server.close(); delete globalThis.__adminDataTest; });
beforeEach(() => {
  state.actor = { id: 'admin', email: 'admin@example.com', role: 'PLATFORM_ADMIN' };
  state.rows = { user: [{ ...state.actor, password: 'stored-secret', resetPasswordToken: 'reset-secret', updatedAt: new Date('2026-11-23T12:00:00Z') }], lot: [], auction: [] };
  state.writes = 0;
});
const event = (model, { method = 'GET', id, body, authenticated = true, origin } = {}) => ({
  params: { model, ...(id ? { id } : {}) },
  url: new URL(`https://pumbi.test/api/admin/data/${model}`),
  locals: { auth: async () => authenticated ? { user: { id: 'admin' } } : null },
  request: new Request(`https://pumbi.test/api/admin/data/${model}${id ? '/' + id : ''}`, { method, headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
});

test('catalog covers every Prisma model and scalar field, with no guessed tables', () => {
  assert.equal(catalog.length, Prisma.dmmf.datamodel.models.length);
  for (const source of Prisma.dmmf.datamodel.models) {
    const model = catalog.find(model => model.name === source.name);
    assert.ok(model, source.name);
    assert.deepEqual(model.fields.map(field => field.name), source.fields.filter(field => field.kind !== 'object').map(field => field.name));
    assert.equal(model.fields.find(field => field.name === 'id').id, true);
  }
  assert.ok(catalog.find(model => model.key === 'user').fields.find(field => field.name === 'password').secret);
  assert.deepEqual(catalog.find(model => model.key === 'user').fields.find(field => field.name === 'role').values, ['BUYER', 'SELLER', 'AUCTIONEER', 'PLATFORM_ADMIN']);
});

test('all collections accept a valid minimal create payload using their required field types', async () => {
  for (const model of service.adminModels) {
    const payload = {};
    for (const field of model.fields.filter(field => field.required)) {
      payload[field.name] = field.values ? field.values[0] : field.type === 'String' ? field.name === 'email' ? 'test@example.com' : 'test-value'
        : field.type === 'Boolean' ? false : field.type === 'DateTime' ? (field.name === 'endDate' ? '2026-11-24T12:00:00Z' : '2026-11-23T12:00:00Z')
        : field.type === 'Json' ? { test: true } : 1;
    }
    const result = await service.parseAdminData(model, payload, { creating: true });
    assert.ok(result, model.key);
  }
});

test('unknown collections, nested relations, invalid enums, empty required text and invalid numbers are rejected', async () => {
  assert.throws(() => service.modelFor('$queryRaw'), err => err.status === 404);
  const user = service.modelFor('user');
  for (const input of [{ auctions: { deleteMany: {} } }, { role: 'SUPERUSER' }, { email: '' }, { isVerifiedBuyer: 'false' }]) await assert.rejects(service.parseAdminData(user, input), err => err.status === 400);
  for (const input of [{ lotNumber: 'NaN' }, { lotNumber: 1.5 }, { lotNumber: 2147483648 }, { currentBid: true }, { currentBid: '' }, { id: 'changed' }]) await assert.rejects(service.parseAdminData(service.modelFor('lot'), input), err => err.status === 400);
});

test('new user passwords are hashed, old reset tokens are cleared, and empty passwords remain unchanged', async () => {
  const data = await service.parseAdminData(service.modelFor('user'), { password: 'Test-password-123' });
  assert.notEqual(data.password, 'Test-password-123');
  assert.equal(await comparePassword('Test-password-123', data.password), true);
  assert.equal(data.resetPasswordToken, null);
  assert.deepEqual(await service.parseAdminData(service.modelFor('user'), { password: '' }), {});
  await assert.rejects(service.parseAdminData(service.modelFor('user'), { password: 'short' }), err => err.status === 400);
});

test('decimal, bigint, dates and JSON retain their intended values', async () => {
  const invoice = await service.parseAdminData(service.modelFor('invoice'), { totalAmount: '123456789.12', paidAt: '2026-11-23T12:00:00Z' });
  assert.equal(invoice.totalAmount, '123456789.12');
  assert.ok(invoice.paidAt instanceof Date);
  const view = await service.parseAdminData(service.modelFor('auction'), { totalDwellMs: '9007199254740993' });
  assert.equal(view.totalDwellMs, 9007199254740993n);
  assert.equal(serializeAdminValue(view).totalDwellMs, '9007199254740993');
  const profile = await service.parseAdminData(service.modelFor('platformPolicy'), { rateConfig: 'literal JSON string' });
  assert.equal(profile.rateConfig, 'literal JSON string');
});

test('list and detail responses never return password hashes or reset tokens', async () => {
  const response = await collection.GET(event('user'));
  const list = await response.json();
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(list.rows[0].password, undefined);
  assert.equal(state.lastList.select.password, undefined);
  const detail = await service.readRecord('user', 'admin');
  assert.equal(detail.record.password, undefined);
  assert.equal(detail.record.resetPasswordToken, undefined);
  assert.equal(detail.secretsSet.password, true);
  assert.ok(!JSON.stringify(detail).includes('stored-secret'));
});

test('every CRUD verb rejects anonymous and non-admin callers before writing', async () => {
  for (const authenticated of [false, true]) {
    state.actor.role = 'SELLER';
    const expected = authenticated ? 403 : 401;
    for (const [handler, method, id] of [[collection.GET,'GET'], [collection.POST,'POST'], [recordRoute.GET,'GET','admin'], [recordRoute.PATCH,'PATCH','admin'], [recordRoute.DELETE,'DELETE','admin']]) {
      await assert.rejects(handler(event('user', { method, id, authenticated, body: method === 'GET' ? null : { data: {} } })), err => err.status === expected);
    }
  }
  assert.equal(state.writes, 0);
});

test('authorized create, edit and confirmed delete work, while stale edits cannot overwrite records', async () => {
  const create = await collection.POST(event('lot', { method: 'POST', body: { data: { auctionId: 'auction', lotNumber: 1, title: 'Test lot', startingBid: 10, bidIncrement: 1 } } }));
  assert.equal(create.status, 201);
  const id = (await create.json()).record.id;
  state.rows.lot[0].updatedAt = new Date('2026-11-23T12:00:00Z');
  await assert.rejects(recordRoute.PATCH(event('lot', { id, method: 'PATCH', body: { data: { title: 'Stale' }, revision: '2026-11-22T12:00:00Z' } })), err => err.status === 409);
  await recordRoute.PATCH(event('lot', { id, method: 'PATCH', body: { data: { title: 'Edited' }, revision: '2026-11-23T12:00:00Z' } }));
  assert.equal(state.rows.lot[0].title, 'Edited');
  await assert.rejects(recordRoute.DELETE(event('lot', { id, method: 'DELETE', body: { confirmation: 'wrong', revision: '2026-11-23T12:00:00Z' } })), err => err.status === 400);
  await recordRoute.DELETE(event('lot', { id, method: 'DELETE', body: { confirmation: id, revision: '2026-11-23T12:00:00Z' } }));
  assert.equal(state.rows.lot.length, 0);
});

test('administrators cannot accidentally remove their own admin access', async () => {
  const options = { key: 'user', id: 'admin', actor: state.actor, revision: '2026-11-23T12:00:00Z' };
  await assert.rejects(service.mutateRecord({ ...options, input: { role: 'BUYER' } }), err => err.status === 409);
  await assert.rejects(service.mutateRecord({ ...options, deleting: true, confirmation: 'admin' }), err => err.status === 409);
  assert.equal(state.writes, 0);
});

test('cross-origin mutations and forged filter fields are rejected', async () => {
  await assert.rejects(collection.POST(event('user', { method: 'POST', body: { data: {} }, origin: 'https://untrusted.test' })), err => err.status === 403);
  await assert.rejects(service.listRecords('user', new URL('https://pumbi.test/?sort=password')), err => err.status === 400);
  await assert.rejects(service.listRecords('user', new URL('https://pumbi.test/?referenceField=password&referenceId=test')), err => err.status === 400);
});

test('relation metadata follows schema cascade and restrict behavior', () => {
  const auction = service.modelFor('auction');
  assert.equal(auction.dependents.find(item => item.model === 'lot').onDelete, 'Cascade');
  assert.deepEqual(auction.dependents.find(item => item.model === 'lot').fields, ['auctionId']);
  const user = service.modelFor('user');
  assert.equal(user.dependents.find(item => item.model === 'invoice').onDelete, 'Restrict');
});
