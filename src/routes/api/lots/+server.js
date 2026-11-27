import { json } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { Lot } from '$lib/models/index.js';
import prisma from '$lib/prisma.js';
import { normalizeLotImages } from '$lib/server/lotImages.js';
import {
  HOUSE_PERMISSIONS,
  canManageAuctionHouse,
  getAuthenticatedUser,
  isPlatformAdmin,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

export async function GET({ url, locals }) {
  const auctionId = url.searchParams.get('auctionId');
  
  if (auctionId) {
    const [auction, user] = await Promise.all([
      prisma.auction.findUnique({ where: { id: auctionId } }),
      getAuthenticatedUser(locals)
    ]);
    if (!auction) return json([]);
    const canManage = auction.type === 'PUBLIC'
      ? isPlatformAdmin(user)
      : canManageAuctionHouse(user, auction.auctionHouseId);
    const allLots = await db.lots.getByAuctionId(auctionId);
    const lots = canManage ? allLots : allLots.filter((lot) => lot.isReady);
    
    // Load bids for each lot
    const lotsWithBids = await Promise.all(
      lots.map(async (lot) => {
        const bids = await db.bids.getByLotId(lot.id);
        return { ...lot, bids };
      })
    );
    
    return json(lotsWithBids);
  }
  
  return json([]);
}

export async function POST({ request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);
    const data = await request.json();
    
    // Separate images from lot data
    const { images, imageUrl, imageUrls, uploadedImages, ...lotData } = data;
    const imageRecords = normalizeLotImages(images ?? (imageUrl ? [{ url: imageUrl }] : Array.isArray(imageUrls) ? imageUrls.map(url => ({ url })) : []));

    if (!lotData.auctionId) {
      return json({ error: 'Auction ID is required' }, { status: 400 });
    }

    const auction = await prisma.auction.findUnique({
      where: { id: lotData.auctionId }
    });
    requireAuctionAccess(user, auction);
    await requireAuctionHousePermission(
      user,
      auction.auctionHouseId,
      HOUSE_PERMISSIONS.MANAGE_CATALOG
    );
    
    // Get the highest position for this auction to set default position
    const existingLots = await db.lots.getByAuctionId(lotData.auctionId);
    const maxPosition = existingLots.length > 0 
      ? Math.max(...existingLots.map(l => l.position || 0))
      : 0;
    
    // Transform data to match Lot model expectations
    const transformedData = {
      ...lotData,
      // Set position if not provided (default to next position)
      position: lotData.position !== undefined ? lotData.position : (maxPosition + 1),
      // Convert status to uppercase if it's lowercase
      status: lotData.status ? lotData.status.toUpperCase() : 'ACTIVE',
      // Keep endTime as string - let the schema handle conversion
      // (empty strings will be converted to null by the schema)
      endTime: lotData.endTime && lotData.endTime.trim() !== '' ? lotData.endTime : null,
      // Ensure currentBid is set if not provided
      currentBid: lotData.currentBid !== undefined ? lotData.currentBid : (lotData.startingBid || 0),
      // Handle tags - if it's already a JSON string, keep it; if array, pass it through (model will stringify)
      tags: lotData.tags !== undefined ? lotData.tags : null
    };
    
    // Validate before writing, then create the lot and its images atomically.
    const model = new Lot(transformedData);
    if (!model.validate()) return json({ error: 'Check the lot fields and try again.', details: model.errors }, { status: 400 });
    const lot = await prisma.lot.create({
      data: { ...model.prepareDataForSave(true), ...(imageRecords.length ? { images: { create: imageRecords } } : {}) },
      select: { id: true }
    });

    // Return lot with images
    const lotWithImages = await db.lots.getById(lot.id);
    return json(lotWithImages, { status: 201 });
  } catch (error) {
    if (error.status) throw error;
    if (error.code === 'P2002') return json({ error: 'This lot number is already in use. Choose another lot number and try again.' }, { status: 409 });
    console.error('Error creating lot:', error);
    return json(
      { 
        error: error.message || 'Failed to create lot',
        details: error.fieldErrors || error.errors || null
      }, 
      { status: 400 }
    );
  }
}

