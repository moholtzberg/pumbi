import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { adminError, requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { PLATFORM_AUCTION_HOUSE_ID } from '$lib/server/platformAuctionHouse.js';

function requiredText(value, label, maxLength = 200) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw error(400, `${label} is required`);
  if (text.length > maxLength) throw error(400, `${label} must be ${maxLength} characters or fewer`);
  return text;
}

function optionalText(value, label, maxLength) {
  if (value == null || value === '') return null;
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) throw error(400, `${label} must be ${maxLength} characters or fewer`);
  return text || null;
}

function dateValue(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw error(400, `${label} must be a valid date`);
  return date;
}

function optionalUrl(value) {
  const text = optionalText(value, 'Image URL', 2000);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw error(400, 'Image URL must be a valid HTTP or HTTPS URL');
  }
}

export async function GET({ locals }) {
  await requirePlatformAdmin(locals);
  const auctions = await prisma.auction.findMany({
    where: { type: 'PUBLIC' },
    take: 50,
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      seriesId: true,
      policyVersionSnapshot: true,
      _count: { select: { lots: true, registrations: true } }
    }
  });
  return json({ auctions });
}

export async function POST({ request, locals }) {
  const admin = await requirePlatformAdmin(locals);

  try {
    const data = await request.json();
    const title = requiredText(data.title, 'Title');
    const description = optionalText(data.description, 'Description', 5000);
    const imageUrl = optionalUrl(data.imageUrl);
    const startDate = dateValue(data.startDate, 'Start date');
    const endDate = dateValue(data.endDate, 'End date');
    const now = new Date();

    if (endDate <= startDate) throw error(400, 'End date must be after start date');
    if (endDate <= now) throw error(400, 'End date must be in the future');

    const [house, policy] = await Promise.all([
      prisma.auctionHouse.findUnique({ where: { id: PLATFORM_AUCTION_HOUSE_ID }, select: { id: true, isActive: true } }),
      prisma.platformPolicy.findFirst({
        where: {
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
      })
    ]);

    if (!house?.isActive) throw error(409, 'The Pumbi platform auction house is not active');
    if (!policy) throw error(409, 'An active Pumbi policy is required before creating a public auction');

    const auction = await prisma.auction.create({
      data: {
        title,
        description,
        imageUrl,
        startDate,
        endDate,
        status: startDate <= now ? 'LIVE' : 'UPCOMING',
        type: 'PUBLIC',
        auctionHouseId: PLATFORM_AUCTION_HOUSE_ID,
        sellerId: admin.id,
        platformPolicyId: policy.id,
        policyVersionSnapshot: policy.version,
        buyerTermsSnapshot: policy.buyerTerms,
        sellerTermsSnapshot: policy.sellerTerms,
        buyerPremiumRateSnapshot: policy.buyerPremiumRate,
        sellerCommissionRateSnapshot: policy.sellerCommissionRate,
        ...(policy.rateConfig === null ? {} : { rateConfigSnapshot: policy.rateConfig })
      },
      select: { id: true, title: true, status: true, startDate: true, endDate: true }
    });

    return json({ auction }, { status: 201 });
  } catch (err) {
    adminError(err, 'Failed to create public auction');
  }
}
