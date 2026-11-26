import { json, error } from '@sveltejs/kit';
import { updateAuctionSettings } from '$lib/server/auctionSettings.js';
import { resolveBidIncrementSchedule } from '$lib/utils/bidIncrements.js';
import { resolveLotTiming } from '$lib/server/lotTiming.js';
import { resolveBuyerPremiumRate, resolveBuyerPaysShipping } from '$lib/server/invoices.js';
import { readSettings } from '$lib/utils/region.js';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  canManageAuctionHouse,
  getAuthenticatedUser,
  isPlatformAdmin,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

export async function GET({ params, locals }) {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: { seller: true, auctionHouse: true }
    });

    if (!auction) {
      throw error(404, 'Auction not found');
    }

    // Parse settings JSON or return empty object
    const settings = { ...(auction.settings ? JSON.parse(auction.settings) : {}), currency: (auction.currency || 'usd').toUpperCase() };

    // For public access (non-logged-in users), only return gallery-related settings
    const user = await getAuthenticatedUser(locals);
    if (!user) {
      // Public access - only return gallery template settings
      return json({
        currency: settings.currency,
        galleryTemplate: settings.galleryTemplate || 'card-grid',
        galleryTemplateSettings: settings.galleryTemplateSettings || {},
        liveVideoUrl: settings.liveVideoUrl || null,
        liveVideoTitle: settings.liveVideoTitle || null,
        liveAudioUrl: settings.liveAudioUrl || null,
        liveAudioTitle: settings.liveAudioTitle || null
      });
    }

    const canManage = auction.type === 'PUBLIC'
      ? isPlatformAdmin(user)
      : canManageAuctionHouse(user, auction.auctionHouseId);
    if (canManage) {
      return json({ ...settings, _inheritance: {
        houseId: auction.auctionHouseId,
        house: (() => { const house = readSettings(auction.auctionHouse?.settings); return { bidIncrements: house.bidIncrements || [], automaticAuctionInitialTimerSeconds: house.automaticAuctionInitialTimerSeconds ?? 60, automaticAuctionTimerResetSeconds: house.automaticAuctionTimerResetSeconds ?? 30, aiPrompt: house.aiPrompt || '' }; })(),
        increments: resolveBidIncrementSchedule(auction),
        timers: resolveLotTiming({ auction, auctionHouse: auction.auctionHouse || {} }),
        buyerPremium: resolveBuyerPremiumRate({ auction, auctionHouse: auction.auctionHouse }),
        buyerPaysShipping: resolveBuyerPaysShipping({ auction, auctionHouse: auction.auctionHouse })
      } }, { headers: { 'cache-control': 'private, no-store' } });
    }

    // Otherwise, return only gallery settings (public access)
    return json({
      currency: settings.currency,
      galleryTemplate: settings.galleryTemplate || 'card-grid',
      galleryTemplateSettings: settings.galleryTemplateSettings || {},
      liveVideoUrl: settings.liveVideoUrl || null,
      liveVideoTitle: settings.liveVideoTitle || null,
      liveAudioUrl: settings.liveAudioUrl || null,
      liveAudioTitle: settings.liveAudioTitle || null
    });
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error fetching auction settings:', err);
    throw error(500, 'Failed to fetch auction settings');
  }
}

export async function PATCH({ params, request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: { seller: true, auctionHouse: true }
    });

    requireAuctionAccess(user, auction);
    await requireAuctionHousePermission(
      user,
      auction.auctionHouseId,
      HOUSE_PERMISSIONS.MANAGE_AUCTIONS
    );

    const data = await request.json();

    if (!data || typeof data !== 'object' || Array.isArray(data)) throw error(400, 'Settings must be an object');
    let validated;
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM auctions WHERE id = ${params.id} FOR UPDATE`;
      const current = await tx.auction.findUnique({ where: { id: params.id }, select: { settings: true } });
      validated = await updateAuctionSettings(current.settings, data, auction.currency || 'usd');
      await tx.auction.update({ where: { id: params.id }, data: { settings: JSON.stringify(validated) } });
    });

    return json({ 
      message: 'Auction settings updated successfully',
      settings: validated
    });
  } catch (err) {
    // Handle Zod validation errors
    if (err.name === 'ZodError') {
      const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw error(400, `Validation error: ${messages}`);
    }

    if (err.status) {
      throw err;
    }
    console.error('Error updating auction settings:', err);
    throw error(500, 'Failed to update auction settings');
  }
}
