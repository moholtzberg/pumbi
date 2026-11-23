import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionHousePermission, permissionsForHouseRole } from '$lib/server/authorization.js';
import { summarizeSellerMetrics } from '$lib/utils/sellerMetrics.js';

export async function GET({ locals, url }) {
  const user = await requireAuthenticatedUser(locals);
  const memberships = user.auctionHouseMemberships?.filter(item => item.status === 'ACTIVE') || [];
  const houseId = url.searchParams.get('auctionHouseId') || user.auctionHouseId
    || memberships.find(item => item.role === 'OWNER')?.auctionHouseId || memberships[0]?.auctionHouseId;
  if (!houseId) throw error(400, 'Select an auction house to view analytics');
  const membership = await requireAuctionHousePermission(user, houseId, HOUSE_PERMISSIONS.VIEW);
  const canViewFinance = permissionsForHouseRole(membership.role).includes(HOUSE_PERMISSIONS.MANAGE_FINANCE);
  const [sales, auctions, invoiceGroups, methodGroups] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "totalLots", COUNT(*) FILTER (WHERE l.status = 'SOLD')::int AS sold,
        COUNT(*) FILTER (WHERE l.status = 'UNSOLD')::int AS unsold,
        COALESCE(SUM(COALESCE(NULLIF(l.current_bid, 0), l.starting_bid)) FILTER (WHERE l.status = 'SOLD'), 0) AS "hammerTotal"
      FROM lots l JOIN auctions a ON a.id = l.auction_id WHERE a.auction_house_id = ${houseId}
    `,
    prisma.auction.groupBy({ by: ['status'], where: { auctionHouseId: houseId }, _count: { _all: true } }),
    canViewFinance ? prisma.invoice.groupBy({
      by: ['currency', 'status'], where: { auctionHouseId: houseId },
      _sum: { totalAmount: true }, _count: { _all: true }
    }) : [],
    canViewFinance ? prisma.invoice.groupBy({
      by: ['currency', 'paymentChannel', 'externalPaymentMethod'], where: { auctionHouseId: houseId, status: 'PAID' },
      _sum: { totalAmount: true }, _count: { _all: true }
    }) : []
  ]);
  return json({
    ...summarizeSellerMetrics({ sales: sales[0], invoices: invoiceGroups, methods: methodGroups, canViewFinance }),
    auctions: { total: auctions.reduce((sum, row) => sum + row._count._all, 0), live: auctions.find(row => row.status === 'LIVE')?._count._all || 0 },
    updatedAt: new Date().toISOString()
  }, { headers: { 'cache-control': 'no-store, private' } });
}
