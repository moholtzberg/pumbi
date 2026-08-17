import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  getEditableHouse,
  onboardingSelect,
  optionalString,
  parseJsonBody,
  requiredString,
  requireHouseEditor,
  requireHouseMember
} from '$lib/server/auctionHouseOnboarding.js';

const BUSINESS_TYPES = new Set([
  'SOLE_PROPRIETORSHIP',
  'PARTNERSHIP',
  'LLC',
  'CORPORATION',
  'NONPROFIT',
  'OTHER'
]);

const STRING_FIELDS = {
  legalName: ['Legal name', 200],
  registrationNumber: ['Registration number', 200],
  website: ['Website', 500],
  contactFirstName: ['Contact first name', 100],
  contactLastName: ['Contact last name', 100],
  contactEmail: ['Contact email', 320],
  contactPhone: ['Contact phone', 100],
  country: ['Country', 100]
};

export async function GET({ params, locals }) {
  await requireHouseMember(locals, params.id);
  const now = new Date();
  const [auctionHouse, policy] = await Promise.all([
    prisma.auctionHouse.findUnique({
      where: { id: params.id },
      select: onboardingSelect
    }),
    prisma.platformPolicy.findFirst({
      where: {
        isActive: true,
        auctionHouseTerms: { not: null },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, auctionHouseTerms: true }
    })
  ]);
  if (!auctionHouse) throw error(404, 'Auction house not found');
  return json({ auctionHouse, policy });
}

export async function PATCH({ params, request, locals }) {
  await requireHouseEditor(locals, params.id);
  await getEditableHouse(params.id);
  const body = await parseJsonBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object');
  }

  const data = {};
  if (Object.hasOwn(body, 'name')) {
    data.name = requiredString(body.name, 'Company name', 200);
  }
  for (const [field, [label, maxLength]] of Object.entries(STRING_FIELDS)) {
    if (Object.hasOwn(body, field)) {
      data[field] = optionalString(body[field], label, maxLength);
    }
  }
  if (Object.hasOwn(body, 'businessType')) {
    if (body.businessType === null || body.businessType === '') {
      data.businessType = null;
    } else if (!BUSINESS_TYPES.has(body.businessType)) {
      throw error(400, 'Invalid business type');
    } else {
      data.businessType = body.businessType;
    }
  }
  if (Object.hasOwn(body, 'onboardingStep')) {
    const step = Number(body.onboardingStep);
    if (!Number.isInteger(step) || step < 0 || step > 7) {
      throw error(400, 'Onboarding step must be between 0 and 7');
    }
    data.onboardingStep = step;
  }
  if (Object.keys(data).length === 0) throw error(400, 'No valid onboarding fields supplied');

  if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
    throw error(400, 'Contact email must be valid');
  }
  if (data.country) {
    data.country = data.country.toUpperCase();
    if (!/^[A-Z]{2}$/.test(data.country)) {
      throw error(400, 'Company country must be a two-letter ISO country code');
    }
  }

  const auctionHouse = await prisma.auctionHouse.update({
    where: { id: params.id },
    data,
    select: onboardingSelect
  });
  return json({ auctionHouse });
}
