import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import prisma from '$lib/prisma.js';
import { auctionUpdateSchema } from '$lib/zod.js';
import {
  HOUSE_PERMISSIONS,
  isPlatformAdmin,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

export async function GET({ params }) {
  const auction = await db.auctions.getById(params.id);
  if (!auction) {
    throw error(404, 'Auction not found');
  }
  return json(auction);
}

export async function PATCH({ params, request, locals }) {
  const user = await requireAuthenticatedUser(locals);
  const existing = await prisma.auction.findUnique({ where: { id: params.id } });
  requireAuctionAccess(user, existing);
  await requireAuctionHousePermission(
    user,
    existing.auctionHouseId,
    HOUSE_PERMISSIONS.MANAGE_AUCTIONS
  );

  const parsed = auctionUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw error(400, {
      message: 'Invalid auction data',
      details: parsed.error.flatten()
    });
  }
  const updates = parsed.data;
  const startDate = updates.startDate || existing.startDate;
  const endDate = updates.endDate || existing.endDate;

  if (endDate <= startDate) {
    throw error(400, 'End date must be after start date');
  }
  if (updates.type && updates.type !== existing.type) {
    throw error(409, 'Auction type cannot be changed after creation');
  }

  if (!isPlatformAdmin(user)) {
    const protectedSnapshotFields = [
      'platformPolicyId',
      'policyVersionSnapshot',
      'buyerTermsSnapshot',
      'sellerTermsSnapshot',
      'buyerPremiumRateSnapshot',
      'sellerCommissionRateSnapshot',
      'rateConfigSnapshot',
      'privateHouseNameSnapshot',
      'privateHouseBuyerTermsSnapshot',
      'privateHouseSellerTermsSnapshot',
      'privateHouseBuyerPremiumRateSnapshot',
      'privateHouseSellerCommissionRateSnapshot',
      'privateHouseRateConfigSnapshot'
    ];
    if (
      (updates.auctionHouseId && updates.auctionHouseId !== existing.auctionHouseId) ||
      (updates.sellerId && updates.sellerId !== existing.sellerId) ||
      protectedSnapshotFields.some((field) => field in updates)
    ) {
      throw error(403, 'Only platform administrators can change auction ownership or policy snapshots');
    }
  }

  if (updates.settings && typeof updates.settings !== 'string') {
    updates.settings = JSON.stringify(updates.settings);
  }

  const auction = await db.auctions.update(params.id, updates);
  if (!auction) {
    throw error(404, 'Auction not found');
  }
  return json(auction);
}

