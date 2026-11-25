import { createRequire } from 'node:module';
import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { HOUSE_PERMISSIONS, requireAuthenticatedUser, requireAuctionHousePermission, requireAuctionHouseTeamManager } from './authorization.js';
import { lockHouseBidderAccess } from './bidderAccess.js';
const { Prisma } = createRequire(import.meta.url)('@prisma/client');
const unpaidStatuses = ['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'];
const pageNumber = value => Math.max(1, Math.min(100000, Number.parseInt(value || '1', 10) || 1));
const privateUserSelect = Prisma.sql`u.id, u.name, u.email, u.phone, u.address, u.first_name AS "firstName", u.last_name AS "lastName", u.is_verified_buyer AS "isVerifiedBuyer", u.created_at AS "createdAt"`;

export async function requireBidderHouse(locals, houseId, { owner = false, client = prisma } = {}) {
  const actor = await requireAuthenticatedUser(locals);
  const membership = owner ? await requireAuctionHouseTeamManager(actor, houseId)
    : await requireAuctionHousePermission(actor, houseId, HOUSE_PERMISSIONS.MANAGE_BIDDERS);
  const house = await client.auctionHouse.findUnique({ where: { id: houseId }, select: { id: true, name: true } });
  if (!house) throw error(404, 'Auction house not found');
  return { actor, house, canViewProfiles: ['OWNER', 'ADMIN'].includes(membership.role) };
}

// Only users with a relationship to this house enter its directory. Explicit
// blocks remain visible even if the underlying participation record is deleted.
function participantWhere(houseId, auctionId = null) {
  const auction = Prisma.sql`a.auction_house_id = ${houseId} AND (${auctionId}::text IS NULL OR a.id = ${auctionId})`;
  return Prisma.sql`(
    EXISTS (SELECT 1 FROM bids b JOIN lots l ON l.id=b.lot_id JOIN auctions a ON a.id=l.auction_id WHERE b.user_id=u.id AND ${auction})
    OR EXISTS (SELECT 1 FROM auction_registrations r JOIN auctions a ON a.id=r.auction_id WHERE r.user_id=u.id AND ${auction})
    OR EXISTS (SELECT 1 FROM lots l JOIN auctions a ON a.id=l.auction_id WHERE l.highest_bidder_id=u.id AND l.status='SOLD' AND ${auction})
    OR EXISTS (SELECT 1 FROM invoices i JOIN auctions a ON a.id=i.auction_id JOIN lots l ON l.id=i.lot_id JOIN auctions la ON la.id=l.auction_id WHERE i.buyer_id=u.id AND i.auction_house_id=${houseId} AND la.auction_house_id=${houseId} AND ${auction})
    OR (${auctionId}::text IS NULL AND EXISTS (SELECT 1 FROM bidder_blocks bb WHERE bb.user_id=u.id AND bb.auction_house_id=${houseId}))
  )`;
}
function auctionParticipation(houseId, userId) {
  return Prisma.sql`a.auction_house_id=${houseId} AND (
    EXISTS (SELECT 1 FROM bids b JOIN lots l ON l.id=b.lot_id WHERE l.auction_id=a.id AND b.user_id=${userId})
    OR EXISTS (SELECT 1 FROM auction_registrations r WHERE r.auction_id=a.id AND r.user_id=${userId})
    OR EXISTS (SELECT 1 FROM lots l WHERE l.auction_id=a.id AND l.highest_bidder_id=${userId} AND l.status='SOLD')
    OR EXISTS (SELECT 1 FROM invoices i JOIN lots l ON l.id=i.lot_id JOIN auctions la ON la.id=l.auction_id WHERE i.auction_id=a.id AND i.auction_house_id=${houseId} AND i.buyer_id=${userId} AND la.auction_house_id=${houseId})
  )`;
}
const invoiceScope = (houseId, userId) => ({ auctionHouseId: houseId, buyerId: userId, auction: { auctionHouseId: houseId }, lot: { auction: { auctionHouseId: houseId } } });
const invoiceSelect = {
  id: true, number: true, lotId: true, status: true, currency: true, totalAmount: true,
  hammerPrice: true, buyerPremiumAmount: true, shippingAmount: true, paidAt: true,
  paymentChannel: true, externalPaymentMethod: true, createdAt: true,
  lot: { select: { id: true, lotNumber: true, title: true } },
  auction: { select: { id: true, title: true } }
};
const invoiceDto = row => ({ ...row, totalAmount: String(row.totalAmount), hammerPrice: String(row.hammerPrice), buyerPremiumAmount: String(row.buyerPremiumAmount), shippingAmount: String(row.shippingAmount) });

export function bidderBalances(groups) {
  const currencies = new Map();
  for (const group of groups) {
    const currency = group.currency.toUpperCase();
    if (!currencies.has(currency)) currencies.set(currency, { currency, paid: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(0), refunded: new Prisma.Decimal(0), cancelled: new Prisma.Decimal(0), paidInvoices: 0, unpaidInvoices: 0 });
    const row = currencies.get(currency), amount = new Prisma.Decimal(group._sum.totalAmount || 0), count = group._count._all;
    if (group.status === 'PAID') { row.paid = row.paid.plus(amount); row.paidInvoices += count; }
    else if (unpaidStatuses.includes(group.status)) { row.outstanding = row.outstanding.plus(amount); row.unpaidInvoices += count; }
    else if (group.status === 'REFUNDED') row.refunded = row.refunded.plus(amount);
    else if (group.status === 'CANCELLED') row.cancelled = row.cancelled.plus(amount);
  }
  return [...currencies.values()].map(row => ({ ...row, paid: row.paid.toFixed(2), outstanding: row.outstanding.toFixed(2), refunded: row.refunded.toFixed(2), cancelled: row.cancelled.toFixed(2) }));
}

export async function listHouseBidders(houseId, { q = '', page = 1, auctionId = null, blockedOnly = false } = {}, client = prisma) {
  page = pageNumber(page); q = String(q || '').trim().slice(0, 160);
  if (auctionId && !await client.auction.findFirst({ where: { id: auctionId, auctionHouseId: houseId }, select: { id: true } })) throw error(404, 'Auction not found in this house');
  const pattern = `%${q}%`;
  const where = Prisma.sql`${participantWhere(houseId, auctionId)} AND (${q}='' OR u.name ILIKE ${pattern} OR u.email ILIKE ${pattern} OR u.phone ILIKE ${pattern}) AND (${blockedOnly}=false OR EXISTS (SELECT 1 FROM bidder_blocks bb WHERE bb.user_id=u.id AND bb.auction_house_id=${houseId} AND bb.active))`;
  const [counts, bidders] = await Promise.all([
    client.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS total FROM users u WHERE ${where}`),
    client.$queryRaw(Prisma.sql`SELECT u.id, u.name, u.email, u.phone, u.is_verified_buyer AS "isVerifiedBuyer",
      EXISTS (SELECT 1 FROM bidder_blocks bb WHERE bb.user_id=u.id AND bb.auction_house_id=${houseId} AND bb.active) AS blocked,
      (SELECT COUNT(*)::int FROM bids b JOIN lots l ON l.id=b.lot_id JOIN auctions a ON a.id=l.auction_id WHERE b.user_id=u.id AND a.auction_house_id=${houseId} AND (${auctionId}::text IS NULL OR a.id=${auctionId})) AS "bidCount"
      FROM users u WHERE ${where} ORDER BY lower(COALESCE(u.name,u.email)), u.id LIMIT 30 OFFSET ${(page - 1) * 30}`)
  ]);
  return { bidders, count: counts[0].total, page, pageSize: 30, q, auctionId, blockedOnly };
}

async function houseBidder(houseId, userId, client) {
  if (typeof userId !== 'string' || !userId) throw error(400, 'Choose a bidder');
  const rows = await client.$queryRaw(Prisma.sql`SELECT ${privateUserSelect} FROM users u WHERE u.id=${userId} AND ${participantWhere(houseId)} LIMIT 1`);
  if (!rows.length) throw error(404, 'Bidder not found in this auction house');
  return rows[0];
}

export async function houseBidderProfile(houseId, userId, options = {}, client = prisma) {
  const user = await houseBidder(houseId, userId, client);
  const auctionPage = pageNumber(options.auctionPage), winPage = pageNumber(options.winPage), invoicePage = pageNumber(options.invoicePage);
  const wonWhere = { highestBidderId: userId, status: 'SOLD', auction: { auctionHouseId: houseId } };
  const invoiceWhere = invoiceScope(houseId, userId);
  const [summaries, auctions, wins, invoices, invoiceGroups, invoiceCount, block] = await Promise.all([
    client.$queryRaw(Prisma.sql`SELECT
      (SELECT COUNT(*)::int FROM auctions a WHERE ${auctionParticipation(houseId, userId)}) AS "auctionCount",
      (SELECT COUNT(*)::int FROM bids b JOIN lots l ON l.id=b.lot_id JOIN auctions a ON a.id=l.auction_id WHERE b.user_id=${userId} AND a.auction_house_id=${houseId}) AS "bidCount",
      (SELECT COUNT(DISTINCT l.id)::int FROM bids b JOIN lots l ON l.id=b.lot_id JOIN auctions a ON a.id=l.auction_id WHERE b.user_id=${userId} AND a.auction_house_id=${houseId}) AS "lotsBidOn",
      (SELECT COUNT(*)::int FROM lots l JOIN auctions a ON a.id=l.auction_id WHERE l.highest_bidder_id=${userId} AND l.status='SOLD' AND a.auction_house_id=${houseId}) AS "lotsWon"`),
    client.$queryRaw(Prisma.sql`SELECT a.id, a.title, a.status, a.start_date AS "startDate", r.status AS "registrationStatus",
      (SELECT COUNT(*)::int FROM bids b JOIN lots l ON l.id=b.lot_id WHERE l.auction_id=a.id AND b.user_id=${userId}) AS "bidCount",
      (SELECT COUNT(*)::int FROM lots l WHERE l.auction_id=a.id AND l.highest_bidder_id=${userId} AND l.status='SOLD') AS "lotsWon",
      (SELECT COUNT(*)::int FROM invoices i JOIN lots l ON l.id=i.lot_id JOIN auctions la ON la.id=l.auction_id WHERE i.auction_id=a.id AND i.auction_house_id=${houseId} AND la.auction_house_id=${houseId} AND i.buyer_id=${userId} AND i.status='PAID') AS "paidInvoices",
      (SELECT COUNT(*)::int FROM invoices i JOIN lots l ON l.id=i.lot_id JOIN auctions la ON la.id=l.auction_id WHERE i.auction_id=a.id AND i.auction_house_id=${houseId} AND la.auction_house_id=${houseId} AND i.buyer_id=${userId} AND i.status IN ('UNPAID','AWAITING_EXTERNAL','PENDING_CHECKOUT')) AS "unpaidInvoices"
      FROM auctions a LEFT JOIN auction_registrations r ON r.auction_id=a.id AND r.user_id=${userId}
      WHERE ${auctionParticipation(houseId, userId)} ORDER BY a.start_date DESC,a.id LIMIT 20 OFFSET ${(auctionPage - 1) * 20}`),
    client.lot.findMany({ where: wonWhere, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (winPage - 1) * 20, take: 20, select: { id: true, lotNumber: true, title: true, currentBid: true, auction: { select: { id: true, title: true } } } }),
    client.invoice.findMany({ where: invoiceWhere, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (invoicePage - 1) * 20, take: 20, select: invoiceSelect }),
    client.invoice.groupBy({ by: ['currency', 'status'], where: invoiceWhere, _sum: { totalAmount: true }, _count: { _all: true } }),
    client.invoice.count({ where: invoiceWhere }),
    client.bidderBlock.findUnique({ where: { auctionHouseId_userId: { auctionHouseId: houseId, userId } }, include: { blockedBy: { select: { name: true, email: true } }, unblockedBy: { select: { name: true, email: true } } } })
  ]);
  const winInvoices = wins.length ? await client.invoice.findMany({ where: { ...invoiceWhere, lotId: { in: wins.map(lot => lot.id) } }, select: invoiceSelect }) : [];
  const invoiceByLot = new Map(winInvoices.map(invoice => [invoice.lotId, invoiceDto(invoice)]));
  return {
    user, summary: { ...summaries[0], balances: bidderBalances(invoiceGroups), invoiceCount },
    auctions, wins: wins.map(lot => ({ ...lot, invoice: invoiceByLot.get(lot.id) || null })),
    invoices: invoices.map(invoiceDto), block,
    pagination: { auctionPage, winPage, invoicePage, pageSize: 20 }
  };
}

export async function setHouseBidderBlock(locals, houseId, userId, { blocked, reason }, client = prisma) {
  const { actor } = await requireBidderHouse(locals, houseId, { owner: true, client });
  if (typeof blocked !== 'boolean') throw error(400, 'Choose block or unblock');
  if (blocked && (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 2000)) throw error(400, 'Enter a block reason (up to 2,000 characters)');
  await houseBidder(houseId, userId, client);
  return client.$transaction(async tx => {
    await lockHouseBidderAccess(tx, houseId, { exclusive: true });
    if (!blocked) {
      await tx.bidderBlock.updateMany({ where: { auctionHouseId: houseId, userId, active: true }, data: { active: false, unblockedAt: new Date(), unblockedById: actor.id } });
      return { blocked: false };
    }
    const data = { active: true, reason: reason.trim(), blockedById: actor.id, blockedAt: new Date(), unblockedAt: null, unblockedById: null };
    await tx.bidderBlock.upsert({ where: { auctionHouseId_userId: { auctionHouseId: houseId, userId } }, create: { auctionHouseId: houseId, userId, ...data }, update: data });
    return { blocked: true };
  });
}
