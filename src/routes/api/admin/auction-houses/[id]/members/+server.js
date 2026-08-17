import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { adminError, requirePlatformAdmin } from '$lib/server/platformAdmin.js';

const ROLES = ['OWNER', 'ADMIN', 'AUCTION_MANAGER', 'CATALOG_MANAGER', 'FINANCE', 'VIEWER'];
const STATUSES = ['ACTIVE', 'SUSPENDED'];
const AUCTIONEER_ROLES = new Set(['OWNER', 'ADMIN', 'AUCTION_MANAGER']);

function legacyUserRole(membershipRole) {
  return AUCTIONEER_ROLES.has(membershipRole) ? 'AUCTIONEER' : 'SELLER';
}

function requiredText(value, field) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw error(400, `${field} is required`);
  return text;
}

function roleValue(value) {
  const role = requiredText(value, 'role').toUpperCase();
  if (!ROLES.includes(role)) throw error(400, 'Invalid team role');
  return role;
}

function statusValue(value) {
  const status = requiredText(value, 'status').toUpperCase();
  if (!STATUSES.includes(status)) throw error(400, 'Invalid membership status');
  return status;
}

async function requireHouse(id) {
  const house = await prisma.auctionHouse.findUnique({ where: { id }, select: { id: true } });
  if (!house) throw error(404, 'Auction house not found');
}

async function protectFinalActiveOwner(tx, auctionHouseId, membership, updates = {}) {
  const losesActiveOwnership =
    membership.role === 'OWNER' &&
    membership.status === 'ACTIVE' &&
    (updates.remove || updates.role !== undefined && updates.role !== 'OWNER' || updates.status !== undefined && updates.status !== 'ACTIVE');
  if (!losesActiveOwnership) return;

  const activeOwners = await tx.auctionHouseMembership.count({
    where: { auctionHouseId, role: 'OWNER', status: 'ACTIVE' }
  });
  if (activeOwners <= 1) throw error(409, 'The final active owner cannot be removed, suspended, or demoted');
}

export async function POST({ params, locals, request }) {
  await requirePlatformAdmin(locals);
  try {
    await requireHouse(params.id);
    const body = await request.json().catch(() => { throw error(400, 'A JSON request body is required'); });
    const email = requiredText(body.email, 'email').toLowerCase();
    const role = roleValue(body.role);
    const status = body.status === undefined ? 'ACTIVE' : statusValue(body.status);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw error(400, 'A valid email is required');

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, role: true }
    });
    if (!user) throw error(404, 'No registered user was found with that email address');

    const membership = await prisma.$transaction(async (tx) => {
      const existing = await tx.auctionHouseMembership.findUnique({
        where: { userId_auctionHouseId: { userId: user.id, auctionHouseId: params.id } },
        select: { id: true }
      });
      if (existing) throw error(409, 'This user already belongs to the auction house');

      const created = await tx.auctionHouseMembership.create({
        data: { auctionHouseId: params.id, userId: user.id, role, status },
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      await tx.user.updateMany({
        where: { id: user.id, auctionHouseId: null },
        data: {
          auctionHouseId: params.id,
          ...(user.role === 'PLATFORM_ADMIN' ? {} : { role: legacyUserRole(role) })
        }
      });
      return created;
    }, { isolationLevel: 'Serializable' });

    return json({ membership }, { status: 201 });
  } catch (err) {
    adminError(err, 'Failed to add auction house member');
  }
}

export async function PATCH({ params, locals, request }) {
  await requirePlatformAdmin(locals);
  try {
    await requireHouse(params.id);
    const body = await request.json().catch(() => { throw error(400, 'A JSON request body is required'); });
    const membershipId = requiredText(body.membershipId, 'membershipId');
    const updates = {};
    if (body.role !== undefined) updates.role = roleValue(body.role);
    if (body.status !== undefined) updates.status = statusValue(body.status);
    if (!Object.keys(updates).length) throw error(400, 'role or status is required');

    const membership = await prisma.$transaction(async (tx) => {
      const current = await tx.auctionHouseMembership.findFirst({
        where: { id: membershipId, auctionHouseId: params.id },
        include: { user: { select: { role: true, auctionHouseId: true } } }
      });
      if (!current) throw error(404, 'Membership not found');
      await protectFinalActiveOwner(tx, params.id, current, updates);
      const updated = await tx.auctionHouseMembership.update({
        where: { id: current.id },
        data: updates,
        include: { user: { select: { id: true, name: true, email: true } } }
      });

      const nextRole = updates.role || current.role;
      const nextStatus = updates.status || current.status;
      if (nextStatus === 'SUSPENDED' && current.user.auctionHouseId === params.id) {
        await tx.user.update({ where: { id: current.userId }, data: { auctionHouseId: null } });
      } else if (
        nextStatus === 'ACTIVE' &&
        (current.user.auctionHouseId === null || current.user.auctionHouseId === params.id)
      ) {
        await tx.user.update({
          where: { id: current.userId },
          data: {
            auctionHouseId: params.id,
            ...(current.user.role === 'PLATFORM_ADMIN' ? {} : { role: legacyUserRole(nextRole) })
          }
        });
      }
      return updated;
    }, { isolationLevel: 'Serializable' });

    return json({ membership });
  } catch (err) {
    adminError(err, 'Failed to update auction house member');
  }
}

export async function DELETE({ params, locals, request }) {
  await requirePlatformAdmin(locals);
  try {
    await requireHouse(params.id);
    const body = await request.json().catch(() => { throw error(400, 'A JSON request body is required'); });
    const membershipId = requiredText(body.membershipId, 'membershipId');

    await prisma.$transaction(async (tx) => {
      const membership = await tx.auctionHouseMembership.findFirst({ where: { id: membershipId, auctionHouseId: params.id } });
      if (!membership) throw error(404, 'Membership not found');
      await protectFinalActiveOwner(tx, params.id, membership, { remove: true });
      await tx.auctionHouseMembership.delete({ where: { id: membership.id } });
      await tx.user.updateMany({ where: { id: membership.userId, auctionHouseId: params.id }, data: { auctionHouseId: null } });
    }, { isolationLevel: 'Serializable' });

    return json({ removed: true });
  } catch (err) {
    adminError(err, 'Failed to remove auction house member');
  }
}
