import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_ROLES,
  HOUSE_ROLE_CAPABILITIES,
  permissionsForHouseRole,
  requireActiveAuctionHouseMember,
  requireAuthenticatedUser,
  requireAuctionHouseTeamManager
} from '$lib/server/authorization.js';
import {
  createInvitationToken,
  deliverAuctionHouseInvitation,
  hashInvitationToken,
  INVITATION_LIFETIME_MS,
  normalizeInvitationEmail
} from '$lib/server/auctionHouseInvitations.js';

const ROLES = Object.values(HOUSE_ROLES);
const STATUSES = ['ACTIVE', 'SUSPENDED'];

async function getHouse(id) {
  const house = await prisma.auctionHouse.findUnique({
    where: { id },
    select: { id: true, name: true }
  });
  if (!house) throw error(404, 'Auction house not found');
  return house;
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw error(400, `${field} is required`);
  }
  return value.trim();
}

function assertRole(role) {
  if (!ROLES.includes(role)) throw error(400, 'Invalid team role');
}

function assertCanManageOwner(actor, currentRole, nextRole) {
  if (
    actor.role !== HOUSE_ROLES.OWNER &&
    (currentRole === HOUSE_ROLES.OWNER || nextRole === HOUSE_ROLES.OWNER)
  ) {
    throw error(403, 'Only an owner can assign, transfer, or demote an owner');
  }
}

async function assertNotFinalActiveOwner(tx, houseId, membership, updates = {}) {
  const losesActiveOwnership =
    membership.role === HOUSE_ROLES.OWNER &&
    membership.status === 'ACTIVE' &&
    (updates.role && updates.role !== HOUSE_ROLES.OWNER ||
      updates.status && updates.status !== 'ACTIVE' ||
      updates.remove);

  if (!losesActiveOwnership) return;

  const activeOwners = await tx.auctionHouseMembership.count({
    where: { auctionHouseId: houseId, role: HOUSE_ROLES.OWNER, status: 'ACTIVE' }
  });
  if (activeOwners <= 1) {
    throw error(409, 'The final active owner cannot be removed, suspended, or demoted');
  }
}

export async function GET({ params, locals }) {
  const user = await requireAuthenticatedUser(locals);
  const house = await getHouse(params.id);
  const actor = await requireActiveAuctionHouseMember(user, house.id);
  const canManageTeam = [HOUSE_ROLES.OWNER, HOUSE_ROLES.ADMIN].includes(actor.role);
  const roleCapabilities = Object.fromEntries(
    ROLES.map((role) => [
      role,
      { ...HOUSE_ROLE_CAPABILITIES[role], permissions: permissionsForHouseRole(role) }
    ])
  );

  const [members, invitations] = await Promise.all([
    prisma.auctionHouseMembership.findMany({
      where: { auctionHouseId: house.id },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, name: true }
        }
      }
    }),
    canManageTeam
      ? prisma.auctionHouseInvitation.findMany({
          where: { auctionHouseId: house.id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            expiresAt: true,
            createdAt: true
          }
        })
      : []
  ]);

  return json({
    auctionHouse: house,
    members,
    invitations,
    roles: roleCapabilities,
    roleCapabilities,
    capabilities: {
      ...HOUSE_ROLE_CAPABILITIES[actor.role],
      permissions: permissionsForHouseRole(actor.role),
      role: actor.role,
      isPlatformAdmin: Boolean(actor.isPlatformAdmin)
    }
  });
}

export async function POST({ params, locals, request, url }) {
  const user = await requireAuthenticatedUser(locals);
  const house = await getHouse(params.id);
  const actor = await requireAuctionHouseTeamManager(user, house.id);
  const body = await request.json().catch(() => {
    throw error(400, 'A JSON request body is required');
  });

  const email = normalizeInvitationEmail(requiredText(body.email, 'email'));
  const firstName = requiredText(body.firstName, 'firstName');
  const lastName = requiredText(body.lastName, 'lastName');
  const role = requiredText(body.role, 'role').toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw error(400, 'A valid email is required');
  assertRole(role);
  assertCanManageOwner(actor, null, role);

  const existingMember = await prisma.auctionHouseMembership.findFirst({
    where: { auctionHouseId: house.id, user: { email: { equals: email, mode: 'insensitive' } } },
    select: { id: true }
  });
  if (existingMember) throw error(409, 'This user is already a member of the auction house');

  await prisma.auctionHouseInvitation.updateMany({
    where: {
      auctionHouseId: house.id,
      email: { equals: email, mode: 'insensitive' },
      status: 'PENDING',
      expiresAt: { lte: new Date() }
    },
    data: { status: 'EXPIRED' }
  });
  const pendingInvite = await prisma.auctionHouseInvitation.findFirst({
    where: {
      auctionHouseId: house.id,
      email: { equals: email, mode: 'insensitive' },
      status: 'PENDING',
      expiresAt: { gt: new Date() }
    },
    select: { id: true }
  });
  if (pendingInvite) throw error(409, 'A pending invitation already exists for this email');

  const token = createInvitationToken();
  const invitation = await prisma.auctionHouseInvitation.create({
    data: {
      auctionHouseId: house.id,
      email,
      firstName,
      lastName,
      role,
      tokenHash: hashInvitationToken(token),
      invitedById: user.id,
      expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS)
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true
    }
  });
  const inviteUrl = `${url.origin}/invites/${encodeURIComponent(token)}`;

  try {
    const result = await deliverAuctionHouseInvitation({
      email,
      firstName,
      auctionHouseName: house.name,
      role,
      inviteUrl
    });
    return json(
      {
        invitation,
        delivery: result.delivery,
        ...(result.delivery === 'manual' ? { inviteUrl } : {})
      },
      { status: 201 }
    );
  } catch {
    await prisma.auctionHouseInvitation.delete({ where: { id: invitation.id } }).catch(() => {});
    throw error(502, 'Invitation email could not be delivered');
  }
}

export async function PATCH({ params, locals, request }) {
  const user = await requireAuthenticatedUser(locals);
  await getHouse(params.id);
  const actor = await requireAuctionHouseTeamManager(user, params.id);
  const body = await request.json().catch(() => {
    throw error(400, 'A JSON request body is required');
  });
  const membershipId = requiredText(body.membershipId, 'membershipId');
  const updates = {};

  if (body.role !== undefined) {
    updates.role = requiredText(body.role, 'role').toUpperCase();
    assertRole(updates.role);
  }
  if (body.status !== undefined) {
    updates.status = requiredText(body.status, 'status').toUpperCase();
    if (!STATUSES.includes(updates.status)) throw error(400, 'Invalid membership status');
  }
  if (!Object.keys(updates).length) throw error(400, 'role or status is required');

  const membership = await prisma.$transaction(async (tx) => {
    const current = await tx.auctionHouseMembership.findFirst({
      where: { id: membershipId, auctionHouseId: params.id }
    });
    if (!current) throw error(404, 'Membership not found');
    assertCanManageOwner(actor, current.role, updates.role);
    await assertNotFinalActiveOwner(tx, params.id, current, updates);
    return tx.auctionHouseMembership.update({
      where: { id: current.id },
      data: updates,
      select: { id: true, userId: true, role: true, status: true, updatedAt: true }
    });
  }, { isolationLevel: 'Serializable' });

  return json({ membership });
}

export async function DELETE({ params, locals, request, url }) {
  const user = await requireAuthenticatedUser(locals);
  await getHouse(params.id);
  const actor = await requireAuctionHouseTeamManager(user, params.id);
  const body = await request.json().catch(() => ({}));
  const invitationId = body.invitationId || url.searchParams.get('invitationId');
  const membershipId = body.membershipId || url.searchParams.get('membershipId');

  if (invitationId) {
    const invitation = await prisma.auctionHouseInvitation.findFirst({
      where: { id: invitationId, auctionHouseId: params.id }
    });
    if (!invitation) throw error(404, 'Invitation not found');
    if (invitation.status !== 'PENDING') throw error(409, 'Only pending invitations can be revoked');
    const revoked = await prisma.auctionHouseInvitation.update({
      where: { id: invitation.id },
      data: { status: 'REVOKED' },
      select: { id: true, status: true, updatedAt: true }
    });
    return json({ invitation: revoked });
  }

  if (!membershipId) throw error(400, 'membershipId or invitationId is required');
  await prisma.$transaction(async (tx) => {
    const membership = await tx.auctionHouseMembership.findFirst({
      where: { id: membershipId, auctionHouseId: params.id }
    });
    if (!membership) throw error(404, 'Membership not found');
    assertCanManageOwner(actor, membership.role, null);
    await assertNotFinalActiveOwner(tx, params.id, membership, { remove: true });
    await tx.auctionHouseMembership.delete({ where: { id: membership.id } });
    await tx.user.updateMany({
      where: { id: membership.userId, auctionHouseId: params.id },
      data: { auctionHouseId: null }
    });
  }, { isolationLevel: 'Serializable' });

  return json({ removed: true });
}
