import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { User } from '$lib/models/index.js';

function safeUser(user) {
  if (!user) return user;
  const { password, ...safe } = user;
  return safe;
}

export async function GET({ url, locals }) {
  const email = url.searchParams.get('email');
  const auctionHouseId = url.searchParams.get('auctionHouseId');
  const session = await locals.auth?.();
  if (!session?.user?.email) throw error(401, 'Authentication required');
  const currentUser = await db.users.getByEmail(session.user.email);
  if (!currentUser) throw error(404, 'User not found');
  const isPlatformAdmin = currentUser.role?.toUpperCase() === 'PLATFORM_ADMIN';
  
  if (email) {
    if (!isPlatformAdmin && email.toLowerCase() !== currentUser.email.toLowerCase()) {
      throw error(403, 'Forbidden');
    }
    const user = await db.users.getByEmail(email);
    if (!user) {
      throw error(404, 'User not found');
    }
    return json(safeUser(user));
  }
  
  if (auctionHouseId) {
    if (!isPlatformAdmin && currentUser.auctionHouseId !== auctionHouseId) {
      throw error(403, 'Forbidden');
    }
    const users = await db.users.getByAuctionHouse(auctionHouseId);
    return json(users.map(safeUser));
  }
  
  return json(safeUser(currentUser));
}

export async function POST({ request, locals }) {
  try {
    const session = await locals.auth?.();
    if (!session?.user?.email) throw error(401, 'Authentication required');
    const data = await request.json();
    if (data.email?.toLowerCase() !== session.user.email.toLowerCase()) {
      throw error(403, 'You may only create your own user record');
    }
    const user = await User.create({
      email: session.user.email,
      name: data.name || session.user.name || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      role: 'BUYER',
      auctionHouseId: null,
      isVerifiedBuyer: false,
      isVerifiedBidder: false
    });
    return json(safeUser(user), { status: 201 });
  } catch (err) {
    console.error('Error creating user:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, err.message || 'Failed to create user');
  }
}


