import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { normalizeMarketingEmail } from './marketingContacts.js';

function signature(payload) {
  if (!env.AUTH_SECRET) throw error(503, 'Email preferences are not configured');
  return createHmac('sha256', env.AUTH_SECRET).update(`marketing-unsubscribe:${payload}`).digest('base64url');
}
export function unsubscribeToken(auctionHouseId, email) {
  const payload = Buffer.from(JSON.stringify({ auctionHouseId, email: normalizeMarketingEmail(email) })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function readUnsubscribeToken(token) {
  if (typeof token !== 'string' || token.length > 2000) throw error(400, 'Invalid email preferences link');
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra) throw error(400, 'Invalid email preferences link');
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(sig);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw error(400, 'Invalid email preferences link');
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.auctionHouseId !== 'string' || !data.auctionHouseId) throw new Error();
    return { auctionHouseId: data.auctionHouseId, email: normalizeMarketingEmail(data.email) };
  } catch { throw error(400, 'Invalid email preferences link'); }
}
export async function unsubscribe(token, client = prisma) {
  const { auctionHouseId, email } = readUnsubscribeToken(token);
  await client.$transaction(async tx => {
    // A deleted house cannot send anything; old preference links still succeed.
    if (!await tx.auctionHouse.findUnique({ where: { id: auctionHouseId }, select: { id: true } })) return;
    await tx.marketingSuppression.upsert({ where: { auctionHouseId_email: { auctionHouseId, email } }, create: { auctionHouseId, email }, update: {} });
    await tx.marketingContact.updateMany({ where: { auctionHouseId, email }, data: { subscribed: false } });
    await tx.marketingMessage.updateMany({ where: { auctionHouseId, email, status: 'QUEUED' }, data: { status: 'CANCELLED', error: 'Unsubscribed' } });
  });
}
