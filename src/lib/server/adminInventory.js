import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { modelFor } from '$lib/server/adminData.js';
export const inventoryStatuses = {
  auctionHouse: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  auction: ['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED'],
  lot: ['ACTIVE', 'SOLD', 'UNSOLD', 'WITHDRAWN'],
};
const text = (url, key) =>
  (url.searchParams.get(key) || '').trim().slice(0, 200);
const contains = (value) => ({ contains: value, mode: 'insensitive' });
export async function loadAdminInventory(kind, { locals, url }) {
  await requirePlatformAdmin(locals);
  if (!inventoryStatuses[kind])
    throw error(404, 'Unknown inventory collection');
  const filters = {
    q: text(url, 'q'),
    status: text(url, 'status'),
    house: text(url, 'house'),
    auction: text(url, 'auction'),
    type: text(url, 'type'),
  };
  if (filters.status && !inventoryStatuses[kind].includes(filters.status))
    throw error(400, 'Choose a valid status');
  if (filters.type && !['PUBLIC', 'PRIVATE'].includes(filters.type))
    throw error(400, 'Choose a valid auction type');
  let house = null,
    auction = null;
  if (filters.house) {
    house = await prisma.auctionHouse.findUnique({
      where: { id: filters.house },
      select: { id: true, name: true },
    });
    if (!house) throw error(404, 'Auction house not found');
  }
  if (filters.auction) {
    auction = await prisma.auction.findUnique({
      where: { id: filters.auction },
      select: { id: true, title: true, auctionHouseId: true },
    });
    if (!auction) throw error(404, 'Auction not found');
    if (house && auction.auctionHouseId !== house.id)
      throw error(400, 'Auction does not belong to this house');
  }
  const where = {};
  if (filters.status)
    where[kind === 'auctionHouse' ? 'onboardingStatus' : 'status'] =
      filters.status;
  if (kind === 'auction') {
    if (filters.house) where.auctionHouseId = filters.house;
    if (filters.type) where.type = filters.type;
  }
  if (kind === 'lot') {
    if (filters.auction) where.auctionId = filters.auction;
    if (filters.house) where.auction = { auctionHouseId: filters.house };
  }
  if (filters.q) {
    if (kind === 'auctionHouse')
      where.OR = ['id', 'name', 'slug', 'legalName', 'contactEmail'].map(
        (key) => ({ [key]: contains(filters.q) }),
      );
    if (kind === 'auction')
      where.OR = [
        { id: contains(filters.q) },
        { title: contains(filters.q) },
        { auctionHouse: { name: contains(filters.q) } },
      ];
    if (kind === 'lot')
      where.OR = [
        { id: contains(filters.q) },
        { title: contains(filters.q) },
        { hebrewTitle: contains(filters.q) },
        { auction: { title: contains(filters.q) } },
        { auction: { auctionHouse: { name: contains(filters.q) } } },
        ...(/^\d+$/.test(filters.q) &&
        Number.isSafeInteger(Number(filters.q)) &&
        Number(filters.q) <= 2147483647
          ? [{ lotNumber: Number(filters.q) }]
          : []),
      ];
  }
  const select =
    kind === 'auctionHouse'
      ? {
          id: true,
          name: true,
          slug: true,
          legalName: true,
          country: true,
          contactEmail: true,
          isActive: true,
          onboardingStatus: true,
          stripeConnectStatus: true,
          _count: {
            select: {
              auctions: true,
              memberships: true,
              locations: true,
              documents: true,
            },
          },
        }
      : kind === 'auction'
        ? {
            id: true,
            title: true,
            type: true,
            status: true,
            currency: true,
            startDate: true,
            endDate: true,
            auctionHouse: { select: { id: true, name: true } },
            _count: { select: { lots: true, registrations: true } },
          }
        : {
            id: true,
            lotNumber: true,
            title: true,
            hebrewTitle: true,
            status: true,
            isReady: true,
            startingBid: true,
            currentBid: true,
            auction: {
              select: {
                id: true,
                title: true,
                type: true,
                currency: true,
                auctionHouse: { select: { id: true, name: true } },
              },
            },
            _count: { select: { images: true, bids: true } },
          };
  const sort = text(url, 'sort') || 'newest';
  if (!['newest', 'oldest', 'name', 'status'].includes(sort))
    throw error(400, 'Choose a valid sort order');
  const orderBy =
    sort === 'name'
      ? { [kind === 'auctionHouse' ? 'name' : 'title']: 'asc' }
      : sort === 'status'
        ? { [kind === 'auctionHouse' ? 'onboardingStatus' : 'status']: 'asc' }
        : { createdAt: sort === 'oldest' ? 'asc' : 'desc' };
  const total = await prisma[kind].count({ where });
  const pageSize = 25,
    pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(text(url, 'page'), 10) || 1),
  );
  const rows = await prisma[kind].findMany({
    where,
    select,
    orderBy: [orderBy, { id: 'asc' }],
    take: pageSize,
    skip: (page - 1) * pageSize,
  });
  return {
    rows,
    total,
    page,
    pages,
    pageSize,
    filters,
    sort,
    context: { house, auction },
    statuses: inventoryStatuses[kind],
    model: modelFor(kind),
  };
}
