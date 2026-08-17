import { json, error } from '@sveltejs/kit';
import { auctionHouseSettingsSchema } from '$lib/zod.js';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

export async function GET({ params, locals }) {
  try {
    const session = await locals.auth?.();
    if (!session?.user) {
      throw error(401, 'Unauthorized');
    }

    const auctionHouse = await prisma.auctionHouse.findUnique({
      where: { id: params.id }
    });

    if (!auctionHouse) {
      throw error(404, 'Auction house not found');
    }

    // Check if user has access to this auction house
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user || user.auctionHouseId !== auctionHouse.id) {
      throw error(403, 'Forbidden');
    }

    // Parse settings JSON or return empty object
    const settings = auctionHouse.settings ? JSON.parse(auctionHouse.settings) : {};

    return json(settings);
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error fetching settings:', err);
    throw error(500, 'Failed to fetch settings');
  }
}

export async function PATCH({ params, request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const auctionHouse = await prisma.auctionHouse.findUnique({
      where: { id: params.id }
    });

    if (!auctionHouse) {
      throw error(404, 'Auction house not found');
    }

    await requireAuctionHousePermission(
      user,
      auctionHouse.id,
      HOUSE_PERMISSIONS.MANAGE_COMPANY
    );

    const data = await request.json();

    // Validate the settings data
    const validated = await auctionHouseSettingsSchema.parseAsync(data);

    // Update the auction house settings
    const updated = await prisma.auctionHouse.update({
      where: { id: params.id },
      data: {
        settings: JSON.stringify(validated)
      }
    });

    return json({ 
      message: 'Settings updated successfully',
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
    console.error('Error updating settings:', err);
    throw error(500, 'Failed to update settings');
  }
}

