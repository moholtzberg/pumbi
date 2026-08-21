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

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      auctionHouseMemberships: {
        where: { status: 'ACTIVE' },
        select: { auctionHouseId: true, role: true }
      }
    }
  });

  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';
  const isHouseStaff = user && ['SELLER', 'AUCTIONEER'].includes(user.role) && user.auctionHouseId;
  const hasControlMembership = user?.auctionHouseMemberships?.some((membership) =>
    ['OWNER', 'ADMIN', 'AUCTION_MANAGER'].includes(membership.role)
  );

  if (!user || (!isPlatformAdmin && !isHouseStaff && !hasControlMembership)) {
    throw redirect(302, '/dashboard');
  }

  const primaryHouseId =
    user.auctionHouseId ||
    user.auctionHouseMemberships.find((membership) => membership.role === 'OWNER')?.auctionHouseId ||
    user.auctionHouseMemberships[0]?.auctionHouseId ||
    null;

  const auctionHouse = primaryHouseId
    ? await prisma.auctionHouse.findUnique({
        where: { id: primaryHouseId },
        select: { id: true, name: true, onboardingStatus: true }
      })
    : null;

  if (!isPlatformAdmin && !auctionHouse) throw redirect(302, '/dashboard');

  const limitedRoutes = ['/seller/onboarding', '/seller/team', '/seller/banking'];
  if (
    !isPlatformAdmin &&
    auctionHouse?.onboardingStatus !== 'APPROVED' &&
    !limitedRoutes.some((path) => url.pathname.startsWith(path))
  ) {
    throw redirect(302, '/seller/onboarding');
  }

  // Return session data for use in child routes
  return {
    session: {
      user: {
        ...session.user,
        role: user.role,
        auctionHouseId: primaryHouseId
      }
    },
    auctionHouse
  };
}

