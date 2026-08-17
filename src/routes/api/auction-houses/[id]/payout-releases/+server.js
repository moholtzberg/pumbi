import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  requireAuthenticatedUser,
  requireAuctionHouseRole
} from '$lib/server/authorization.js';
import {
  assertHousePayoutReady,
  assertSellerPayoutReady,
  parsePayoutRequest,
  PAYOUT_HOUSE_ROLES
} from '$lib/server/payouts.js';

async function requirePayoutHouse(locals, id) {
  const user = await requireAuthenticatedUser(locals);
  await requireAuctionHouseRole(user, id, PAYOUT_HOUSE_ROLES);
  assertSellerPayoutReady(user);
  const house = await prisma.auctionHouse.findUnique({ where: { id } });
  if (!house) throw error(404, 'Auction house not found');
  assertHousePayoutReady(house);
  return { user, house };
}

export async function GET({ params, locals }) {
  const { house } = await requirePayoutHouse(locals, params.id);
  const releases = await prisma.payoutRelease.findMany({
    where: { auctionHouseId: house.id },
    orderBy: { requestedAt: 'desc' },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } }
    }
  });
  return json({ releases });
}

export async function POST({ params, locals, request }) {
  const { user, house } = await requirePayoutHouse(locals, params.id);
  const values = parsePayoutRequest(await request.json().catch(() => ({})));
  try {
    const release = await prisma.payoutRelease.create({
      data: {
        auctionHouseId: house.id,
        requestedById: user.id,
        ...values
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } }
      }
    });
    return json(release, { status: 201 });
  } catch (err) {
    if (err?.code === 'P2002') {
      throw error(409, 'This source reference already has a payout release');
    }
    throw err;
  }
}
