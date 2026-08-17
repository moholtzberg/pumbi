import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  getEditableHouse,
  optionalString,
  parseJsonBody,
  requiredString,
  requireHouseEditor
} from '$lib/server/auctionHouseOnboarding.js';

const LOCATION_TYPES = new Set(['HEADQUARTERS', 'OFFICE', 'WAREHOUSE', 'SHOWROOM', 'OTHER']);
const OPTIONAL_FIELDS = {
  name: ['Location name', 200],
  addressLine2: ['Address line 2', 300],
  stateProvince: ['State/province', 150],
  postalCode: ['Postal code', 50],
  contactName: ['Contact name', 200],
  contactEmail: ['Contact email', 320],
  contactPhone: ['Contact phone', 100]
};
const REQUIRED_FIELDS = {
  addressLine1: ['Address line 1', 300],
  city: ['City', 150],
  country: ['Country', 100]
};

async function ownedLocation(tx, auctionHouseId, locationId) {
  const location = await tx.auctionHouseLocation.findFirst({
    where: { id: locationId, auctionHouseId }
  });
  if (!location) throw error(404, 'Location not found');
  return location;
}

export async function PATCH({ params, request, locals }) {
  await requireHouseEditor(locals, params.id);
  await getEditableHouse(params.id);
  const body = await parseJsonBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object');
  }

  const data = {};
  for (const [field, [label, maxLength]] of Object.entries(OPTIONAL_FIELDS)) {
    if (Object.hasOwn(body, field)) data[field] = optionalString(body[field], label, maxLength);
  }
  for (const [field, [label, maxLength]] of Object.entries(REQUIRED_FIELDS)) {
    if (Object.hasOwn(body, field)) data[field] = requiredString(body[field], label, maxLength);
  }
  if (Object.hasOwn(body, 'type')) {
    if (!LOCATION_TYPES.has(body.type)) throw error(400, 'Invalid location type');
    data.type = body.type;
  }
  if (Object.hasOwn(body, 'businessHours')) data.businessHours = body.businessHours ?? null;
  if (Object.keys(data).length === 0 && !Object.hasOwn(body, 'isPrimary')) {
    throw error(400, 'No valid location fields supplied');
  }

  const location = await prisma.$transaction(async (tx) => {
    const current = await ownedLocation(tx, params.id, params.locationId);
    if (body.isPrimary === false && current.isPrimary) {
      throw error(409, 'Choose another primary location instead of removing the current primary');
    }
    if (body.isPrimary === true && !current.isPrimary) {
      await tx.auctionHouseLocation.updateMany({
        where: { auctionHouseId: params.id, isPrimary: true },
        data: { isPrimary: false }
      });
      data.isPrimary = true;
    }
    return tx.auctionHouseLocation.update({ where: { id: current.id }, data });
  }, { isolationLevel: 'Serializable' });

  return json({ location });
}

export async function DELETE({ params, locals }) {
  await requireHouseEditor(locals, params.id);
  await getEditableHouse(params.id);

  await prisma.$transaction(async (tx) => {
    const current = await ownedLocation(tx, params.id, params.locationId);
    if (current.isPrimary) {
      const replacement = await tx.auctionHouseLocation.findFirst({
        where: { auctionHouseId: params.id, id: { not: current.id } },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      if (!replacement) {
        throw error(409, 'An auction house must retain at least one primary location');
      }
      await tx.auctionHouseLocation.update({
        where: { id: replacement.id },
        data: { isPrimary: true }
      });
    }
    await tx.auctionHouseLocation.delete({ where: { id: current.id } });
  }, { isolationLevel: 'Serializable' });

  return new Response(null, { status: 204 });
}
