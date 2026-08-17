import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';

const AUCTION_HOUSE_STAFF_ROLES = new Set(['SELLER', 'AUCTIONEER']);
export const HOUSE_ROLES = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  AUCTION_MANAGER: 'AUCTION_MANAGER',
  CATALOG_MANAGER: 'CATALOG_MANAGER',
  FINANCE: 'FINANCE',
  VIEWER: 'VIEWER'
});
export const HOUSE_PERMISSIONS = Object.freeze({
  MANAGE_COMPANY: 'MANAGE_COMPANY',
  MANAGE_TEAM: 'MANAGE_TEAM',
  MANAGE_AUCTIONS: 'MANAGE_AUCTIONS',
  MANAGE_CATALOG: 'MANAGE_CATALOG',
  MANAGE_BIDDERS: 'MANAGE_BIDDERS',
  MANAGE_FINANCE: 'MANAGE_FINANCE',
  VIEW: 'VIEW'
});

const ROLE_PERMISSIONS = {
  OWNER: Object.values(HOUSE_PERMISSIONS),
  ADMIN: Object.values(HOUSE_PERMISSIONS),
  AUCTION_MANAGER: [
    HOUSE_PERMISSIONS.MANAGE_AUCTIONS,
    HOUSE_PERMISSIONS.MANAGE_CATALOG,
    HOUSE_PERMISSIONS.MANAGE_BIDDERS,
    HOUSE_PERMISSIONS.VIEW
  ],
  CATALOG_MANAGER: [
    HOUSE_PERMISSIONS.MANAGE_CATALOG,
    HOUSE_PERMISSIONS.VIEW
  ],
  FINANCE: [
    HOUSE_PERMISSIONS.MANAGE_FINANCE,
    HOUSE_PERMISSIONS.VIEW
  ],
  VIEWER: [HOUSE_PERMISSIONS.VIEW]
};

export const HOUSE_ROLE_CAPABILITIES = Object.freeze({
  OWNER: Object.freeze({
    label: 'Owner',
    manageTeam: true,
    inviteMembers: true,
    assignOwner: true,
    manageAuctions: true,
    manageCatalog: true,
    manageFinance: true
  }),
  ADMIN: Object.freeze({
    label: 'Admin',
    manageTeam: true,
    inviteMembers: true,
    assignOwner: false,
    manageAuctions: true,
    manageCatalog: true,
    manageFinance: true
  }),
  AUCTION_MANAGER: Object.freeze({
    label: 'Auction manager',
    manageTeam: false,
    inviteMembers: false,
    assignOwner: false,
    manageAuctions: true,
    manageCatalog: true,
    manageFinance: false
  }),
  CATALOG_MANAGER: Object.freeze({
    label: 'Catalog manager',
    manageTeam: false,
    inviteMembers: false,
    assignOwner: false,
    manageAuctions: false,
    manageCatalog: true,
    manageFinance: false
  }),
  FINANCE: Object.freeze({
    label: 'Finance',
    manageTeam: false,
    inviteMembers: false,
    assignOwner: false,
    manageAuctions: false,
    manageCatalog: false,
    manageFinance: true
  }),
  VIEWER: Object.freeze({
    label: 'Viewer',
    manageTeam: false,
    inviteMembers: false,
    assignOwner: false,
    manageAuctions: false,
    manageCatalog: false,
    manageFinance: false
  })
});

export const TEAM_MANAGER_ROLES = Object.freeze([HOUSE_ROLES.OWNER, HOUSE_ROLES.ADMIN]);

export async function getAuthenticatedUser(locals) {
  const session = await locals.auth?.();
  const email = session?.user?.email;

  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    include: {
      auctionHouseMemberships: {
        select: { auctionHouseId: true, role: true, status: true }
      }
    }
  });
}

export async function requireAuthenticatedUser(locals, message = 'Unauthorized') {
  const user = await getAuthenticatedUser(locals);

  if (!user) {
    throw error(401, message);
  }

  return user;
}

export function isPlatformAdmin(user) {
  return user?.role === 'PLATFORM_ADMIN';
}

export function canManageAuctionHouse(user, auctionHouseId) {
  const membership = user?.auctionHouseMemberships?.find(
    (candidate) => candidate.auctionHouseId === auctionHouseId
  );
  return Boolean(
    user &&
    (isPlatformAdmin(user) ||
      (membership
        ? membership.status === 'ACTIVE'
        : AUCTION_HOUSE_STAFF_ROLES.has(user.role) &&
          user.auctionHouseId === auctionHouseId))
  );
}

export function requireAuctionHouseAccess(user, auctionHouseId) {
  if (!canManageAuctionHouse(user, auctionHouseId)) {
    throw error(403, 'You do not have permission to manage this auction house');
  }
}

export function requireAuctionAccess(user, auction) {
  if (!auction) {
    throw error(404, 'Auction not found');
  }

  if (auction.type === 'PUBLIC') {
    if (!isPlatformAdmin(user)) {
      throw error(403, 'Only platform administrators can manage public auctions');
    }
    return;
  }

  requireAuctionHouseAccess(user, auction.auctionHouseId);
}

export async function getAuctionHouseMembership(user, auctionHouseId) {
  if (!user || !auctionHouseId) return null;
  if (isPlatformAdmin(user)) {
    return { role: HOUSE_ROLES.OWNER, status: 'ACTIVE', isPlatformAdmin: true };
  }
  return prisma.auctionHouseMembership.findUnique({
    where: {
      userId_auctionHouseId: {
        userId: user.id,
        auctionHouseId
      }
    }
  });
}

export async function requireAuctionHouseRole(user, auctionHouseId, allowedRoles) {
  const membership = await getAuctionHouseMembership(user, auctionHouseId);
  if (
    !membership ||
    membership.status !== 'ACTIVE' ||
    !allowedRoles.includes(membership.role)
  ) {
    throw error(403, 'You do not have permission for this auction-house operation');
  }
  return membership;
}

export async function requireAuctionHousePermission(user, auctionHouseId, permission) {
  const membership = await getAuctionHouseMembership(user, auctionHouseId);
  const permissions = membership ? ROLE_PERMISSIONS[membership.role] || [] : [];
  if (
    !membership ||
    membership.status !== 'ACTIVE' ||
    !permissions.includes(permission)
  ) {
    throw error(403, 'Your auction-house role does not allow this operation');
  }
  return membership;
}

export function permissionsForHouseRole(role) {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

export async function requireActiveAuctionHouseMember(user, auctionHouseId) {
  return requireAuctionHouseRole(user, auctionHouseId, Object.values(HOUSE_ROLES));
}

export async function requireAuctionHouseTeamManager(user, auctionHouseId) {
  return requireAuctionHouseRole(user, auctionHouseId, TEAM_MANAGER_ROLES);
}
