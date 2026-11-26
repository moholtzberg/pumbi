import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { modelFor } from '$lib/server/adminData.js';

export async function load({ params, locals }) {
  await requirePlatformAdmin(locals);
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
  return { house, model: modelFor('auctionHouse') };
}
