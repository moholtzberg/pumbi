import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { uploadImageForm, prepareUploadImage, MAX_UPLOAD_IMAGE_BYTES } from '../src/lib/utils/imageUpload.js';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3l0AAAAASUVORK5CYII=', 'base64');
const state = globalThis.__imageUploadTest = { env: {} };
const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [{
  name: 'image-upload-fixtures', enforce: 'pre', resolveId(id) {
    if (['$lib/prisma.js', '$lib/server/authorization.js', '$lib/services/cloudStorage.js', '$lib/services/backgroundRemoval.js', '$lib/utils/s3Presigned.js', '$env/dynamic/private'].includes(id)) return '\0image-' + id;
    if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
  }, load(id) {
    if (id === '\0image-$env/dynamic/private') return 'export const env=globalThis.__imageUploadTest.env;';
    if (id === '\0image-$lib/prisma.js') return 'export default new Proxy({}, {get:(_,key)=>globalThis.__imageUploadTest.db[key]});';
    if (id === '\0image-$lib/server/authorization.js') return `import{error}from'@sveltejs/kit'; export const HOUSE_PERMISSIONS={MANAGE_CATALOG:'MANAGE_CATALOG'};export async function requireAuthenticatedUser(){if(!globalThis.__imageUploadTest.user)throw error(401,'Unauthorized');return globalThis.__imageUploadTest.user;}export const getAuthenticatedUser=requireAuthenticatedUser;export const isPlatformAdmin=()=>false;export const canManageAuctionHouse=()=>true;export function requireAuctionAccess(){if(globalThis.__imageUploadTest.denied)throw error(403,'Forbidden');}export async function requireAuctionHousePermission(){if(globalThis.__imageUploadTest.denied)throw error(403,'Forbidden');}`;
    if (id === '\0image-$lib/services/cloudStorage.js') return `export async function uploadFile(...args){globalThis.__imageUploadTest.uploads.push(args);return {url:'lots/photo.png',key:'lots/photo.png'};}export const getStorageProviderName=()=> 's3';`;
    if (id === '\0image-$lib/services/backgroundRemoval.js') return 'export const removeBackground=async()=>({success:false});';
    if (id === '\0image-$lib/utils/s3Presigned.js') return `export const convertToPresignedUrl=async value=>'https://storage.example/'+value+'?signed=1';`;
  }
}] });
const upload = await server.ssrLoadModule('/src/routes/api/upload/image/+server.js');
const analysis = await server.ssrLoadModule('/src/routes/api/lot-submissions/analyze-image/+server.js');
const validation = await server.ssrLoadModule('/src/lib/server/uploadImages.js');
const images = await server.ssrLoadModule('/src/lib/server/lotImages.js');
after(async () => { await server.close(); delete globalThis.__imageUploadTest; });
beforeEach(() => { state.user = { id: 'user', email: 'user@example.invalid' }; state.denied = false; state.uploads = []; state.db = { user: { findUnique: async () => state.user }, lot: { findUnique: async () => ({ auction: { auctionHouseId: 'house' } }) } }; });
const file = () => new File([png], 'תמונה.JPG', { type: 'image/jpeg' });
const request = (form) => ({ request: new Request('https://pumbi.test/api/upload/image', { method: 'POST', body: form }), locals: { auth: async () => ({ user: { email: 'user@example.invalid' } }) } });

test('upload detects image bytes, supplies the correct MIME, and returns a readable preview separately from its persistent key', async () => {
  const form = new FormData(); form.append('files', file());
  const result = await (await upload.POST(request(form))).json();
  assert.equal(result.images[0].key, 'lots/photo.png'); assert.equal(result.images[0].url, 'lots/photo.png');
  assert.match(result.images[0].previewUrl, /^https:/); assert.equal(result.images[0].type, 'image/png');
  assert.equal(state.uploads[0][3], 'image/png'); assert.equal(result.images[0].backgroundRemoved, false);
});
test('invalid files, empty selections, oversized requests and unauthorized callers do not write storage', async () => {
  const bad = new FormData(); bad.append('files', new File(['not an image'], 'fake.png', { type: 'image/png' }));
  await assert.rejects(upload.POST(request(bad)), err => err.status === 400);
  await assert.rejects(upload.POST(request(new FormData())), err => err.status === 400);
  await assert.rejects(validation.readUploadImage(new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png')), err => err.status === 413);
  state.user = null; const form = new FormData(); form.append('files', file());
  await assert.rejects(upload.POST(request(form)), err => err.status === 401); assert.equal(state.uploads.length, 0);
});
test('uploads for an existing lot enforce catalog permissions', async () => {
  state.denied = true; const form = new FormData(); form.append('files', file()); form.append('lotId', 'lot');
  await assert.rejects(upload.POST(request(form)), err => err.status === 403); assert.equal(state.uploads.length, 0);
});
test('optional background removal failure preserves original photo and reports it accurately', async () => {
  const form = new FormData(); form.append('files', file()); form.append('removeBackground', 'true');
  const image = (await (await upload.POST(request(form))).json()).images[0];
  assert.equal(image.backgroundRemoved, false); assert.equal(image.type, 'image/png');
});
test('AI not being configured does not discard or reject the successfully uploaded seller photo', async () => {
  const prior = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try {
    const form = new FormData(); form.append('image', file());
    const response = await analysis.POST(request(form)); const data = await response.json();
    assert.equal(response.status, 201); assert.equal(data.listing, null); assert.match(data.warning, /Photo uploaded/);
    assert.equal(data.image.key, 'lots/photo.png'); assert.equal(state.uploads.length, 1);
  } finally { if (prior === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prior; }
});
test('client sends one prepared file at a time, retains preview keys, and preserves successful uploads on partial failure', async () => {
  const form = new FormData(); form.append('files', file()); form.append('files', file()); form.append('lotId', 'lot');
  let calls = 0;
  const response = await uploadImageForm(form, { prepare: async f => f, fetcher: async (url, options) => {
    assert.equal(options.body.getAll('files').length, 1); assert.equal(options.body.get('lotId'), 'lot'); assert.equal(options.credentials, 'include');
    calls++; return calls === 1 ? Response.json({ images: [{ key: 'lots/one.png', previewUrl: 'https://preview' }] }) : Response.json({ message: 'Storage unavailable' }, { status: 503 });
  } });
  const data = await response.json(); assert.equal(response.status, 503); assert.equal(data.images.length, 1); assert.equal(data.error, 'Storage unavailable');
});
test('small files remain unchanged and large photos are resized below the per-request limit', async () => {
  const small = file(); assert.equal(await prepareUploadImage(small), small);
  const previousDocument = globalThis.document, previousBitmap = globalThis.createImageBitmap;
  let closed = false, drew = false;
  globalThis.createImageBitmap = async () => ({ width: 6000, height: 4000, close() { closed = true; } });
  const canvas = { getContext: () => ({ drawImage() { drew = true; } }), toBlob(callback, type) { callback(new Blob([png], { type })); } };
  globalThis.document = { createElement: () => canvas };
  try {
    const prepared = await prepareUploadImage(new File([new Uint8Array(MAX_UPLOAD_IMAGE_BYTES + 1)], 'photo.jpg', { type: 'image/jpeg' }));
    assert.ok(prepared.size < MAX_UPLOAD_IMAGE_BYTES); assert.ok(canvas.width <= 2560); assert.equal(drew, true); assert.equal(closed, true);
  } finally { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; if (previousBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = previousBitmap; }
});
test('lot image validation runs before persistence and retains one primary without forcing existing images to lose theirs', () => {
  assert.throws(() => images.normalizeLotImages([{ url: 'javascript:bad' }]), err => err.status === 400);
  assert.equal(images.normalizeLotImages([{ url: 'lots/one.png' }, { url: 'https://example.com/two.png', isPrimary: true }]).filter(x => x.isPrimary).length, 1);
  assert.equal(images.normalizeLotImages([{ url: 'lots/one.png', isPrimary: false }], { defaultPrimary: false })[0].isPrimary, false);
});
