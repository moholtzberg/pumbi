import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  getEditableHouse,
  optionalString,
  parseJsonBody,
  requiredString,
  requireHouseEditor,
  requireHouseMember
} from '$lib/server/auctionHouseOnboarding.js';

const LOCATION_TYPES = new Set(['HEADQUARTERS', 'OFFICE', 'WAREHOUSE', 'SHOWROOM', 'OTHER']);

function locationData(body) {
  const type = body.type || 'OTHER';
  if (!LOCATION_TYPES.has(type)) throw error(400, 'Invalid location type');
  return {
    name: optionalString(body.name, 'Location name', 200),
    type,
    addressLine1: requiredString(body.addressLine1, 'Address line 1', 300),
    addressLine2: optionalString(body.addressLine2, 'Address line 2', 300),
    city: requiredString(body.city, 'City', 150),
    stateProvince: optionalString(body.stateProvince, 'State/province', 150),
    postalCode: optionalString(body.postalCode, 'Postal code', 50),
    country: requiredString(body.country, 'Country', 100),
    contactName: optionalString(body.contactName, 'Contact name', 200),
    contactEmail: optionalString(body.contactEmail, 'Contact email', 320),
    contactPhone: optionalString(body.contactPhone, 'Contact phone', 100),
    businessHours: body.businessHours ?? null
  };
}

export async function GET({ params, locals }) {
  await requireHouseMember(locals, params.id);
  const exists = await prisma.auctionHouse.findUnique({
    where: { id: params.id },
    select: { id: true }
  });
  if (!exists) throw error(404, 'Auction house not found');
  const locations = await prisma.auctionHouseLocation.findMany({
    where: { auctionHouseId: params.id },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
  });
  return json({ locations });
}

export async function POST({ params, request, locals }) {
  await requireHouseEditor(locals, params.id);
  await getEditableHouse(params.id);
  const body = await parseJsonBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object');
  }
  const data = locationData(body);

  const location = await prisma.$transaction(async (tx) => {
    const count = await tx.auctionHouseLocation.count({ where: { auctionHouseId: params.id } });
    const existingPrimary = count === 0 ? null : await tx.auctionHouseLocation.findFirst({
      where: { auctionHouseId: params.id, isPrimary: true },
      select: { id: true }
    });
    const isPrimary = count === 0 || !existingPrimary || body.isPrimary === true;
    if (isPrimary && count > 0) {
      await tx.auctionHouseLocation.updateMany({
        where: { auctionHouseId: params.id, isPrimary: true },
        data: { isPrimary: false }
      });
    }
    return tx.auctionHouseLocation.create({
      data: { ...data, isPrimary, auctionHouseId: params.id }
    });
  }, { isolationLevel: 'Serializable' });

  return json({ location }, { status: 201 });
}
