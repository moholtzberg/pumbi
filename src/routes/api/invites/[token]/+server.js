import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser } from '$lib/server/authorization.js';
import { hashInvitationToken, normalizeInvitationEmail } from '$lib/server/auctionHouseInvitations.js';

const AUCTIONEER_MEMBERSHIP_ROLES = new Set(['OWNER', 'ADMIN', 'AUCTION_MANAGER']);

async function findInvitation(token, client = prisma) {
  if (typeof token !== 'string' || !token) return null;
  return client.auctionHouseInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { auctionHouse: { select: { id: true, name: true } } }
  });
}

export async function GET({ params }) {
  const invitation = await findInvitation(params.token);
  if (!invitation || invitation.status !== 'PENDING') {
    throw error(404, 'Invitation not found');
  }
  if (invitation.expiresAt <= new Date()) {
    await prisma.auctionHouseInvitation.updateMany({
      where: { id: invitation.id, status: 'PENDING' },
      data: { status: 'EXPIRED' }
    });
    throw error(410, 'Invitation has expired');
  }

  return json({
    auctionHouseName: invitation.auctionHouse.name,
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    role: invitation.role,
    expiresAt: invitation.expiresAt
  });
}

export async function POST({ params, locals }) {
  const user = await requireAuthenticatedUser(locals, 'Sign in to accept this invitation');
  const tokenHash = hashInvitationToken(params.token);

  const accepted = await prisma.$transaction(async (tx) => {
    const invitation = await tx.auctionHouseInvitation.findUnique({
      where: { tokenHash },
      include: { auctionHouse: { select: { id: true, name: true } } }
    });
    if (!invitation) throw error(404, 'Invitation not found');
    if (invitation.status !== 'PENDING') throw error(409, 'Invitation is no longer pending');
    if (invitation.expiresAt <= new Date()) {
      await tx.auctionHouseInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' }
      });
      throw error(410, 'Invitation has expired');
    }
    if (normalizeInvitationEmail(user.email) !== normalizeInvitationEmail(invitation.email)) {
      throw error(403, 'Sign in with the email address that was invited');
    }

    const claimed = await tx.auctionHouseInvitation.updateMany({
      where: { id: invitation.id, status: 'PENDING' },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedById: user.id
      }
    });
    if (claimed.count !== 1) throw error(409, 'Invitation is no longer pending');

    const membership = await tx.auctionHouseMembership.upsert({
      where: {
        userId_auctionHouseId: {
          userId: user.id,
          auctionHouseId: invitation.auctionHouseId
        }
      },
      create: {
        userId: user.id,
        auctionHouseId: invitation.auctionHouseId,
        role: invitation.role,
        status: 'ACTIVE'
      },
      update: {
        role: invitation.role,
        status: 'ACTIVE'
      },
      select: { id: true, role: true, status: true }
    });

    const legacyRole = AUCTIONEER_MEMBERSHIP_ROLES.has(invitation.role)
      ? 'AUCTIONEER'
      : 'SELLER';
    await tx.user.update({
      where: { id: user.id },
      data: {
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        name: `${invitation.firstName} ${invitation.lastName}`.trim(),
        auctionHouseId: invitation.auctionHouseId,
        ...(user.role === 'PLATFORM_ADMIN' ? {} : { role: legacyRole })
      }
    });

    return {
      auctionHouse: invitation.auctionHouse,
      membership
    };
  }, { isolationLevel: 'Serializable' });

  return json({ accepted: true, ...accepted });
}
