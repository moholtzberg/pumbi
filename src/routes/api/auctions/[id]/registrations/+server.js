import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

async function requireAuctionManager(locals, auctionId) {
  const user = await requireAuthenticatedUser(locals, 'Authentication required');
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(
    user,
    auction.auctionHouseId,
    HOUSE_PERMISSIONS.MANAGE_BIDDERS
  );
  return { user, auction };
}

export async function GET({ params, locals, url }) {
  await requireAuctionManager(locals, params.id);
  const requestedStatus = url.searchParams.get('status')?.toUpperCase();

  const registrations = await prisma.auctionRegistration.findMany({
    where: {
      auctionId: params.id,
      ...(requestedStatus ? { status: requestedStatus } : {})
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          isVerifiedBuyer: true,
          isVerifiedBidder: true
        }
      },
      reviewedBy: { select: { id: true, name: true, email: true } }
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
  });

  return json(registrations);
}

export async function PATCH({ params, locals, request }) {
  const { user } = await requireAuctionManager(locals, params.id);
  const body = await request.json();
  const status = String(body.status || '').toUpperCase();

  if (!body.registrationId || !['APPROVED', 'REJECTED'].includes(status)) {
    throw error(400, 'registrationId and APPROVED or REJECTED status are required');
  }
  if (status === 'REJECTED' && !String(body.rejectionReason || '').trim()) {
    throw error(400, 'A rejection reason is required');
  }

  const existing = await prisma.auctionRegistration.findFirst({
    where: { id: body.registrationId, auctionId: params.id }
  });
  if (!existing) throw error(404, 'Registration not found');

  const registration = await prisma.auctionRegistration.update({
    where: { id: existing.id },
    data: {
      status,
      reviewedById: user.id,
      reviewedAt: new Date(),
      rejectionReason: status === 'REJECTED' ? String(body.rejectionReason).trim() : null
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } }
    }
  });

  return json(registration);
}
