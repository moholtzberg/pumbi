import { redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';

/**
 * Server-side authentication check for all seller portal routes
 * This ensures users cannot access seller routes after session expiration
 */
export async function load({ locals, url }) {
  const session = await locals.auth?.();
  
  // If no session, redirect to login
  if (!session?.user) {
    throw redirect(302, `/auth/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !['SELLER', 'AUCTIONEER'].includes(user.role) || !user.auctionHouseId) {
    throw redirect(302, '/dashboard');
  }
  
  // Return session data for use in child routes
  return {
    session: {
      user: {
        ...session.user,
        role: user.role,
        auctionHouseId: user.auctionHouseId
      }
    }
  };
}

