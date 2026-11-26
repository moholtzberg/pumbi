import { error, redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  normalizeHouseSlug,
  houseSlugProblem,
  publicHousePath,
} from '$lib/utils/houseSlugs.js';
import { readSettings } from '$lib/utils/region.js';
import { invoiceHouseContact } from '$lib/utils/addresses.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';
async function publicImage(value) {
  if (!value) return null;
  try {
    return await convertToPresignedUrl(value);
  } catch {
    return null;
  }
}
export async function loadHouseStorefront({ params, url }) {
  const slug = normalizeHouseSlug(params.slug);
  if (houseSlugProblem(slug)) throw error(404, 'Auction house not found');
  // Exact lookup is canonical. The fallback supports older mixed-case records.
  let house = await prisma.auctionHouse.findUnique({
    where: { slug },
    select: houseSelect,
  });
  if (!house)
    house = await prisma.auctionHouse.findFirst({
      where: { slug: { equals: slug, mode: 'insensitive' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: houseSelect,
    });
  if (!house || !house.isActive || house.onboardingStatus !== 'APPROVED')
    throw error(404, 'Auction house not found');
  const path = publicHousePath(house.slug);
  if (url.pathname !== path) throw redirect(308, path + url.search);
  const filter = ['current', 'past', 'all'].includes(
    url.searchParams.get('status'),
  )
    ? url.searchParams.get('status')
    : 'current';
  const where = {
    auctionHouseId: house.id,
    status: {
      in:
        filter === 'past'
          ? ['ENDED']
          : filter === 'all'
            ? ['UPCOMING', 'LIVE', 'ENDED']
            : ['UPCOMING', 'LIVE'],
    },
  };
  const total = await prisma.auction.count({ where });
  const pageSize = 12,
    pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1),
  );
  const auctions = await prisma.auction.findMany({
    where,
    orderBy: [{ startDate: filter === 'past' ? 'desc' : 'asc' }, { id: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      status: true,
      startDate: true,
      endDate: true,
      currency: true,
      _count: { select: { lots: { where: { isReady: true } } } },
    },
  });
  const contact = invoiceHouseContact({
    ...house,
    settings: readSettings(house.settings),
  });
  let website = null;
  try {
    const parsed = new URL(contact.website);
    if (['http:', 'https:'].includes(parsed.protocol)) website = parsed.href;
  } catch {
    /* No public web link. */
  }
  return {
    house: {
      id: house.id,
      name: house.name,
      slug: normalizeHouseSlug(house.slug),
      description: house.description,
      logoUrl: await publicImage(house.logoUrl),
      address: contact.address,
      email: contact.email,
      phone: contact.phone,
      website,
    },
    auctions: await Promise.all(
      auctions.map(async (auction) => ({
        id: auction.id,
        title: auction.title,
        description: auction.description,
        status: auction.status,
        startDate: auction.startDate,
        endDate: auction.endDate,
        currency: auction.currency,
        lotCount: auction._count.lots,
        imageUrl: await publicImage(auction.imageUrl),
      })),
    ),
    filter,
    total,
    page,
    pages,
    canonical: new URL(path, url.origin).href,
  };
}
const houseSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  isActive: true,
  onboardingStatus: true,
  contactEmail: true,
  contactPhone: true,
  website: true,
  settings: true,
  locations: {
    where: { type: 'HEADQUARTERS' },
    select: {
      type: true,
      isPrimary: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      stateProvince: true,
      postalCode: true,
      country: true,
      contactEmail: true,
      contactPhone: true,
    },
  },
};
