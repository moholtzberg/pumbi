import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';

export async function PATCH({ params, request, locals }) {
  try {
    // Check authentication
    const session = await locals.auth?.();
    if (!session?.user) {
      throw error(401, 'Unauthorized');
    }
    
    // Get user from database
    const currentUser = await db.users.getByEmail(session.user.email);
    if (!currentUser) {
      throw error(404, 'User not found');
    }
    
    // Check if user is updating their own profile
    if (currentUser.id !== params.id) {
      throw error(403, 'You can only update your own profile');
    }
    
    const data = await request.json();
    
    // Update user
    const phone = data.phone || null;
    const updatedUser = await db.users.update(params.id, {
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      phone,
      ...(phone !== currentUser.phone ? { phoneVerifiedAt: null, isVerifiedBuyer: false } : {}),
      address: data.address || null,
      name: data.firstName && data.lastName 
        ? `${data.firstName} ${data.lastName}`.trim()
        : data.firstName || data.lastName || currentUser.name
    });
    
    return json(updatedUser);
  } catch (err) {
    console.error('Error updating user:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, err.message || 'Failed to update user');
  }
}
