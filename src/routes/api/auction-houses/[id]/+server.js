import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

export async function GET({ params, locals }) {
  try {
    const auctionHouse = await db.auctionHouses.getById(params.id);
    if (!auctionHouse) {
      throw error(404, 'Auction house not found');
    }
    return json(auctionHouse);
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error fetching auction house:', err);
    throw error(500, 'Failed to fetch auction house');
  }
}

export async function PATCH({ params, request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const auctionHouse = await db.auctionHouses.getById(params.id);
    if (!auctionHouse) {
      throw error(404, 'Auction house not found');
    }
    await requireAuctionHousePermission(
      user,
      auctionHouse.id,
      HOUSE_PERMISSIONS.MANAGE_COMPANY
    );

    const data = await request.json();
    
    // Only allow updating specific fields
    const allowedFields = ['name', 'description', 'domain', 'logoUrl'];
    const updates = {};
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates[field] = data[field] || null;
      }
    }

    if (Object.keys(updates).length === 0) {
      throw error(400, 'No valid fields to update');
    }

    const updated = await db.auctionHouses.update(params.id, updates);

    return json({
      message: 'Auction house updated successfully',
      auctionHouse: updated
    });
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error updating auction house:', err);
    throw error(500, err.message || 'Failed to update auction house');
  }
}



