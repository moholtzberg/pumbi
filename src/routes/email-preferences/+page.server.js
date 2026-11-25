import prisma from '$lib/prisma.js';
import { readUnsubscribeToken, unsubscribe } from '$lib/server/marketingPreferences.js';
export async function load({ url, setHeaders }) {
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
  const { auctionHouseId } = readUnsubscribeToken(url.searchParams.get('token'));
  const house = await prisma.auctionHouse.findUnique({ where: { id: auctionHouseId }, select: { name: true } });
  return { houseName: house?.name || 'this auction house' };
}
export const actions = {
  default: async ({ url }) => {
    await unsubscribe(url.searchParams.get('token'));
    return { unsubscribed: true };
  }
};
