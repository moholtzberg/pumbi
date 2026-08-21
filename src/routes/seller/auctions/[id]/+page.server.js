import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireAuctionAccess } from '$lib/server/authorization.js';

export async function load({ params, parent }) {
  const { session } = await parent();
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { auctionHouseMemberships: true }
  });
  if (!user) throw error(401, 'Authentication required');

  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    include: {
      auctionHouse: { select: { id: true, name: true } },
      _count: { select: { lots: true, registrations: true } }
    }
  });
  if (!auction) throw error(404, 'Auction not found');

  requireAuctionAccess(user, auction);

  return {
    auction: {
      id: auction.id,
      title: auction.title,
      description: auction.description,
      status: auction.status,
      type: auction.type,
      startDate: auction.startDate,
      endDate: auction.endDate,
      imageUrl: auction.imageUrl,
      auctionHouseName: auction.auctionHouse?.name || null,
      lotCount: auction._count.lots,
      registrationCount: auction._count.registrations
    }
  };
}
