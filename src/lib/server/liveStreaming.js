import { randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';

export const broadcasterIdentity = 'auctioneer';
export const streamRoom = (auctionId) => `pumbi-auction-${auctionId}`;
export const streamFinished = (auction) => ['ENDED', 'CANCELLED'].includes(auction.status);

export function streamingConfigured() {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

function configuration() {
  if (!streamingConfigured()) throw error(503, 'Live video is not configured. Add the LiveKit credentials to the server environment.');
  let url;
  try { url = new URL(env.LIVEKIT_URL); } catch { throw error(503, 'Live video server URL is invalid'); }
  if (url.protocol !== 'wss:') throw error(503, 'Live video requires a secure wss:// server URL');
  return { url: url.toString(), apiKey: env.LIVEKIT_API_KEY, secret: env.LIVEKIT_API_SECRET };
}

export async function createStreamToken(auction, publisher = false) {
  if (streamFinished(auction)) throw error(409, 'This auction has ended');
  const config = configuration();
  const token = new AccessToken(config.apiKey, config.secret, {
    identity: publisher ? broadcasterIdentity : `viewer-${randomUUID()}`,
    name: publisher ? 'Auctioneer' : 'Viewer',
    ttl: '2m'
  });
  token.addGrant({
    room: streamRoom(auction.id),
    roomJoin: true,
    canPublish: publisher,
    canPublishSources: publisher ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    canSubscribe: !publisher,
    canPublishData: false,
    canUpdateOwnMetadata: false
  });
  return { url: config.url, token: await token.toJwt(), broadcasterIdentity };
}

export async function stopAuctionStream(auctionId) {
  const config = configuration();
  const service = new RoomServiceClient(config.url.replace(/^wss:/, 'https:'), config.apiKey, config.secret);
  try {
    await service.removeParticipant(streamRoom(auctionId), broadcasterIdentity);
  } catch (err) {
    // Stopping is idempotent when the browser has already disconnected.
    if (err.code !== 'not_found' && err.status !== 404) throw err;
  }
}
