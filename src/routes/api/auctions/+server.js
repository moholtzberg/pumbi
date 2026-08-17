import { json } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import prisma from '$lib/prisma.js';
import { auctionCreateSchema } from '$lib/zod.js';
import {
  isPlatformAdmin,
  requireAuthenticatedUser,
  requireAuctionHouseAccess
} from '$lib/server/authorization.js';

export async function GET({ url }) {
  try {
    const status = url.searchParams.get('status');
    const sellerId = url.searchParams.get('sellerId');
    const auctionHouseId = url.searchParams.get('auctionHouseId');
    
    const options = {};
    if (auctionHouseId) {
      options.auctionHouseId = auctionHouseId;
    }
    
    let auctions = await db.auctions.getAll(options);
    
    // Ensure auctions is an array
    if (!Array.isArray(auctions)) {
      console.error('auctions.getAll did not return an array:', auctions);
      return json([]);
    }
    
    if (status) {
      auctions = auctions.filter(a => a.status && a.status.toLowerCase() === status.toLowerCase());
    }
    
    if (sellerId) {
      auctions = auctions.filter(a => a.sellerId === sellerId);
    }

    return json(auctions);
  } catch (error) {
    console.error('Error in GET /api/auctions:', error);
    console.error('Error stack:', error.stack);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);
    const auctionData = auctionCreateSchema.parse(await request.json());
    requireAuctionHouseAccess(user, auctionData.auctionHouseId);

    if (!isPlatformAdmin(user) && auctionData.type !== 'PRIVATE') {
      return json({ error: 'Auction houses may only create private auctions' }, { status: 403 });
    }

    if (!isPlatformAdmin(user)) {
      const seller = await prisma.user.findUnique({ where: { id: auctionData.sellerId } });
      if (!seller || seller.auctionHouseId !== auctionData.auctionHouseId) {
        return json({ error: 'Seller must belong to the owning auction house' }, { status: 400 });
      }
    }

    if (auctionData.settings && typeof auctionData.settings !== 'string') {
      auctionData.settings = JSON.stringify(auctionData.settings);
    }

    const safeAuctionData = { ...auctionData };
    for (const field of [
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
    ]) {
      delete safeAuctionData[field];
    }

    let snapshotData = {};
    if (safeAuctionData.type === 'PRIVATE') {
      const house = await prisma.auctionHouse.findUnique({ where: { id: safeAuctionData.auctionHouseId } });
      if (!house) return json({ error: 'Auction house not found' }, { status: 404 });
      let houseSettings = {};
      try {
        houseSettings = house.settings ? JSON.parse(house.settings) : {};
      } catch {
        houseSettings = {};
      }
      snapshotData = {
        privateHouseNameSnapshot: house.name,
        privateHouseBuyerTermsSnapshot: houseSettings.termsOfSaleInEnglish || null,
        privateHouseSellerTermsSnapshot: houseSettings.disclaimerForSellersInEnglish || null,
        privateHouseBuyerPremiumRateSnapshot: Number(houseSettings.buyersPremium || 0) / 100,
        privateHouseSellerCommissionRateSnapshot: Number(houseSettings.sellerCommissionRate || 0) / 100,
        privateHouseRateConfigSnapshot: {
          currency: houseSettings.defaultCurrency || 'USD',
          paymentMethods: houseSettings.paymentMethods || [],
          bidIncrements: houseSettings.bidIncrements || [],
          addVat: Boolean(houseSettings.addVat)
        }
      };
    } else {
      const policy = await prisma.platformPolicy.findFirst({
        where: {
          isActive: true,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }]
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
      });
      if (!policy) return json({ error: 'An active Pumbi policy is required for public auctions' }, { status: 409 });
      snapshotData = {
        platformPolicyId: policy.id,
        policyVersionSnapshot: policy.version,
        buyerTermsSnapshot: policy.buyerTerms,
        sellerTermsSnapshot: policy.sellerTerms,
        buyerPremiumRateSnapshot: policy.buyerPremiumRate,
        sellerCommissionRateSnapshot: policy.sellerCommissionRate,
        rateConfigSnapshot: policy.rateConfig
      };
    }

    const auction = await db.auctions.create({ ...safeAuctionData, ...snapshotData });
    return json(auction, { status: 201 });
  } catch (error) {
    if (error.status) throw error;
    console.error('Error creating auction:', error);

    if (error.name === 'ZodError') {
      return json({ error: 'Invalid auction data', details: error.flatten() }, { status: 400 });
    }

    return json({ 
      error: error.message || 'Failed to create auction',
      code: error.code,
      details: error.meta 
    }, { status: 500 });
  }
}

