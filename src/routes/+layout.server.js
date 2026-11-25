import prisma from '$lib/prisma.js';

export async function load({ locals, depends }) {
  depends('auth:session');
  const session = await locals.auth();
  if (!session?.user) return { navigationUser: null };

  // Only expose the fields the menu needs, never the complete user record.
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true, name: true, email: true, role: true, auctionHouseId: true,
      auctionHouseMemberships: {
        where: { status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN', 'AUCTION_MANAGER'] } },
        select: { auctionHouseId: true }
      }
    }
  });

  return {
    navigationUser: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hasAuctionHouse: Boolean(
        (['SELLER', 'AUCTIONEER'].includes(user.role) && user.auctionHouseId) ||
        user.auctionHouseMemberships.length
      )
    } : null
  };
}
