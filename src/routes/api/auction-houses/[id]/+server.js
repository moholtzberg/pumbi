import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import prisma from '$lib/prisma.js';

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
    const session = await locals.auth?.();
    if (!session?.user) {
      throw error(401, 'Unauthorized');
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      throw error(401, 'User not found');
    }

    // Check if user has access to this auction house
    const auctionHouse = await db.auctionHouses.getById(params.id);
    if (!auctionHouse) {
      throw error(404, 'Auction house not found');
    }

    if (user.auctionHouseId !== auctionHouse.id) {
      throw error(403, 'Forbidden: You do not have access to this auction house');
    }

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



