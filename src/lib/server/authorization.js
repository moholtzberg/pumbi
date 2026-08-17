import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';

const AUCTION_HOUSE_STAFF_ROLES = new Set(['SELLER', 'AUCTIONEER']);

export async function getAuthenticatedUser(locals) {
  const session = await locals.auth?.();
  const email = session?.user?.email;

  if (!email) return null;

  return prisma.user.findUnique({ where: { email } });
}

export async function requireAuthenticatedUser(locals, message = 'Unauthorized') {
  const user = await getAuthenticatedUser(locals);

  if (!user) {
    throw error(401, message);
  }

  return user;
}

export function isPlatformAdmin(user) {
  return user?.role === 'PLATFORM_ADMIN';
}

export function canManageAuctionHouse(user, auctionHouseId) {
  return Boolean(
    user &&
    (isPlatformAdmin(user) ||
      (AUCTION_HOUSE_STAFF_ROLES.has(user.role) &&
        user.auctionHouseId === auctionHouseId))
  );
}

export function requireAuctionHouseAccess(user, auctionHouseId) {
  if (!canManageAuctionHouse(user, auctionHouseId)) {
    throw error(403, 'You do not have permission to manage this auction house');
  }
}

export function requireAuctionAccess(user, auction) {
  if (!auction) {
    throw error(404, 'Auction not found');
  }

  if (auction.type === 'PUBLIC') {
    if (!isPlatformAdmin(user)) {
      throw error(403, 'Only platform administrators can manage public auctions');
    }
    return;
  }

  requireAuctionHouseAccess(user, auction.auctionHouseId);
}
