import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
import { AuctionStream } from '../src/lib/utils/auctionStream.js';

const state = globalThis.__auctionStreamingTest = {
  env: { LIVEKIT_URL: 'wss://test.livekit.cloud', LIVEKIT_API_KEY: 'test-key', LIVEKIT_API_SECRET: 'test-secret-for-signing-only-not-a-real-credential' }
};
const deny = status => { const err = new Error('Denied'); err.status = status; throw err; };
state.prisma = { auction: { findUnique: async () => state.auction } };
state.auth = {
  requireAuthenticatedUser: async () => state.user || deny(401),
  requireAuctionAccess: user => { if (user.auctionHouseId !== 'house') deny(403); },
  requireAuctionHousePermission: async user => { if (!user.canManage) deny(403); }
};
const mocks = {
  '$env/dynamic/private': 'export const env = globalThis.__auctionStreamingTest.env;',
  '$lib/prisma.js': 'export default globalThis.__auctionStreamingTest.prisma;',
  '$lib/server/authorization.js': `
    export const HOUSE_PERMISSIONS = { MANAGE_AUCTIONS: 'MANAGE_AUCTIONS' };
    export const { requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission } = globalThis.__auctionStreamingTest.auth;`
};
const server = await createServer({
  configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true },
  plugins: [{
    name: 'streaming-test-adapters',
    resolveId(id) {
      if (mocks[id]) return '\0' + id;
      if (id.startsWith('$lib/')) return fileURLToPath(new URL('../src/lib/' + id.slice(5), import.meta.url));
    },
    load(id) { if (id.startsWith('\0')) return mocks[id.slice(1)]; }
  }]
});
const route = await server.ssrLoadModule('/src/routes/api/auctions/[id]/stream/+server.js');
const originalRemove = RoomServiceClient.prototype.removeParticipant;
RoomServiceClient.prototype.removeParticipant = async (room, identity) => { state.removed = { room, identity }; };
after(async () => {
  RoomServiceClient.prototype.removeParticipant = originalRemove;
  await server.close();
  delete globalThis.__auctionStreamingTest;
});
beforeEach(() => {
  state.auction = { id: 'auction-1', auctionHouseId: 'house', type: 'PRIVATE', status: 'LIVE', auctioneerId: 'seller-1' };
  state.user = { id: 'seller-1', auctionHouseId: 'house', canManage: true };
  state.removed = null;
});
const event = role => ({ params: { id: 'auction-1' }, locals: {}, request: new Request('https://pumbi.test/api/auctions/auction-1/stream', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role })
}) });
async function claims(role) {
  const response = await route.POST(event(role));
  assert.match(response.headers.get('cache-control'), /no-store/);
  const body = await response.json();
  const verifier = new TokenVerifier(state.env.LIVEKIT_API_KEY, state.env.LIVEKIT_API_SECRET);
  return { body, claims: await verifier.verify(body.token) };
}

test('anonymous viewers receive short-lived, room-scoped, subscribe-only tokens', async () => {
  state.user = null;
  const first = await claims('viewer');
  const second = await claims('viewer');
  assert.notEqual(first.claims.sub, second.claims.sub);
  assert.equal(first.claims.video.room, 'pumbi-auction-auction-1');
  assert.equal(first.claims.video.canPublish, false);
  assert.equal(first.claims.video.canPublishData, false);
  assert.equal(first.claims.video.canSubscribe, true);
  assert.ok(first.claims.exp - first.claims.nbf <= 120);
  assert.equal(first.body.publisherUserId, null);
  assert.ok(!JSON.stringify(first.body).includes(state.env.LIVEKIT_API_SECRET));
});

test('only the assigned auctioneer receives camera/microphone publishing grants', async () => {
  const token = await claims('publisher');
  assert.equal(token.claims.sub, 'auctioneer');
  assert.equal(token.claims.video.canPublish, true);
  assert.equal(token.claims.video.canSubscribe, false);
  assert.deepEqual(token.claims.video.canPublishSources, ['camera', 'microphone']);
  assert.equal(token.body.publisherUserId, 'seller-1');
  state.user.id = 'another-seller';
  await assert.rejects(route.POST(event('publisher')), err => err.status === 403);
});

test('publishing and stopping require authentication and auction-management access', async () => {
  state.user.canManage = false;
  await assert.rejects(route.POST(event('publisher')), err => err.status === 403);
  await assert.rejects(route.DELETE(event()), err => err.status === 403);
  state.user = null;
  await assert.rejects(route.POST(event('publisher')), err => err.status === 401);
});

test('ended or cancelled auctions cannot issue media tokens', async () => {
  for (const status of ['ENDED', 'CANCELLED']) {
    state.auction.status = status;
    await assert.rejects(route.POST(event('viewer')), err => err.status === 409);
    await assert.rejects(route.POST(event('publisher')), err => err.status === 409);
    assert.equal((await (await route.GET(event())).json()).finished, true);
  }
});

test('missing setup reports unavailable without exposing credentials', async () => {
  const secret = state.env.LIVEKIT_API_SECRET;
  state.env.LIVEKIT_API_SECRET = '';
  try {
    assert.equal((await (await route.GET(event())).json()).configured, false);
    await assert.rejects(route.POST(event('viewer')), err => err.status === 503);
  } finally { state.env.LIVEKIT_API_SECRET = secret; }
});

test('stop revokes only this auction publisher connection', async () => {
  await route.DELETE(event());
  assert.deepEqual(state.removed, { room: 'pumbi-auction-auction-1', identity: 'auctioneer' });
});

test('unknown auctions and token roles are rejected', async () => {
  await assert.rejects(route.POST(event('admin')), err => err.status === 400);
  state.auction = null;
  await assert.rejects(route.GET(event()), err => err.status === 404);
});

function browserFixture() {
  const rooms = [];
  const tracks = ['video', 'audio'].map(kind => ({
    kind, stopped: false, muted: false,
    stop() { this.stopped = true; },
    async mute() { this.muted = true; }, async unmute() { this.muted = false; },
    mediaStreamTrack: new EventTarget()
  }));
  class Room extends EventEmitter {
    constructor() { super(); rooms.push(this); this.published = []; this.localParticipant = { publishTrack: async track => { this.published.push(track); } }; }
    async connect() { this.connected = true; }
    async disconnect() { this.connected = false; this.emit('disconnected'); }
  }
  let cameraRequests = 0;
  const sdk = {
    Room,
    RoomEvent: Object.fromEntries(['TrackSubscribed', 'TrackUnsubscribed', 'TrackMuted', 'TrackUnmuted', 'Reconnecting', 'Reconnected', 'Disconnected'].map(name => [name, name.toLowerCase()])),
    Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
    createLocalTracks: async () => { cameraRequests++; return tracks; }
  };
  const stream = new AuctionStream({
    sdk, endpoint: '/stream', onChange: () => {},
    fetcher: async () => ({ ok: true, json: async () => ({ url: 'wss://test', token: 'test-token', broadcasterIdentity: 'auctioneer' }) })
  });
  return { stream, sdk, rooms, tracks, cameraRequests: () => cameraRequests };
}

test('preview stays local, going live publishes tracks, and disconnect releases devices', async () => {
  const { stream, tracks, rooms } = browserFixture();
  await stream.preview();
  assert.equal(stream.state.status, 'preview');
  assert.equal(stream.state.live, false);
  assert.equal(rooms.length, 0);
  await stream.connect(true);
  assert.equal(stream.state.live, true);
  assert.deepEqual(rooms[0].published, tracks);
  await stream.toggleMicrophone();
  assert.equal(tracks[1].muted, true);
  await stream.toggleMicrophone();
  assert.equal(tracks[1].muted, false);
  stream.disconnect();
  assert.ok(tracks.every(track => track.stopped));
  assert.equal(stream.state.video, null);
  assert.equal(rooms[0].connected, false);
});

test('viewer waits for broadcast, receives only auctioneer tracks, and never opens devices', async () => {
  const { stream, sdk, rooms, cameraRequests } = browserFixture();
  await stream.connect(false);
  assert.equal(cameraRequests(), 0);
  assert.equal(stream.state.status, 'waiting');
  const room = rooms[0];
  const camera = { kind: 'video' };
  const publication = { source: 'camera', isMuted: false };
  room.emit(sdk.RoomEvent.TrackSubscribed, camera, publication, { identity: 'viewer-fake' });
  assert.equal(stream.state.video, null);
  room.emit(sdk.RoomEvent.TrackSubscribed, camera, publication, { identity: 'auctioneer' });
  assert.equal(stream.state.video, camera);
  assert.equal(stream.state.live, true);
  room.emit(sdk.RoomEvent.TrackUnsubscribed, camera);
  assert.equal(stream.state.live, false);
  room.emit(sdk.RoomEvent.TrackSubscribed, camera, publication, { identity: 'auctioneer' });
  assert.equal(stream.state.live, true);
  stream.disconnect();
});

test('closing during a pending permission request stops the tracks when they arrive', async () => {
  const { stream, sdk, tracks } = browserFixture();
  let resolve;
  sdk.createLocalTracks = () => new Promise(done => { resolve = done; });
  const preview = stream.preview();
  stream.disconnect();
  resolve(tracks);
  await preview;
  assert.ok(tracks.every(track => track.stopped));
  assert.equal(stream.state.video, null);
});

test('failed publishing releases both devices and the room connection', async () => {
  const { stream, tracks, rooms } = browserFixture();
  const originalConnect = stream.sdk.Room.prototype.connect;
  stream.sdk.Room.prototype.connect = async function () {
    await originalConnect.call(this);
    this.localParticipant.publishTrack = async () => { throw new Error('Publish failed'); };
  };
  await assert.rejects(stream.connect(true), /Publish failed/);
  assert.ok(tracks.every(track => track.stopped));
  assert.equal(rooms[0].connected, false);
});

test('leaving while a token request is pending never opens a room', async () => {
  const { stream, rooms } = browserFixture();
  let resolve;
  stream.fetcher = () => new Promise(done => { resolve = done; });
  const connection = stream.connect(false);
  stream.disconnect();
  resolve({ ok: true, json: async () => ({ url: 'wss://test', token: 'test-token' }) });
  await connection;
  assert.equal(rooms.length, 0);
  assert.equal(stream.state.status, 'idle');
});

test('a camera stopped by the browser releases the microphone and room too', async () => {
  const { stream, rooms, tracks } = browserFixture();
  await stream.connect(true);
  tracks[0].mediaStreamTrack.dispatchEvent(new Event('ended'));
  assert.ok(tracks.every(track => track.stopped));
  assert.equal(rooms[0].connected, false);
  assert.equal(stream.state.live, false);
});
