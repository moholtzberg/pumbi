import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';

export async function load({ params }) {
  const house = await prisma.auctionHouse.findUnique({
    where: { id: params.id },
    include: {
      locations: { orderBy: { isPrimary: 'desc' } },
      documents: { orderBy: { createdAt: 'desc' } },
      memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { auctions: true, invitations: true, payoutReleases: true } }
    }
  });
  if (!house) throw error(404, 'Auction house not found');
  return { house };
}
