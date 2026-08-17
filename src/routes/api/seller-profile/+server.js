import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireCurrentUser } from '$lib/server/seller-submissions.js';

const profileSelect = {
  id: true,
  displayName: true,
  legalName: true,
  contactEmail: true,
  contactPhone: true,
  address: true,
  createdAt: true,
  updatedAt: true
};

function profileData(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object');
  }

  const fields = ['displayName', 'legalName', 'contactEmail', 'contactPhone', 'address'];
  const data = {};

  for (const field of fields) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw error(400, `${field} must be a string`);
    }
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length > (field === 'address' ? 1000 : 200)) {
      throw error(400, `${field} is too long`);
    }
    data[field] = trimmed || null;
  }

  if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
    throw error(400, 'Enter a valid contact email');
  }

  return data;
}

export async function GET({ locals }) {
  const user = await requireCurrentUser(locals);
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: profileSelect
  });

  return json({ profile });
}

async function upsertProfile({ request, locals }) {
  const user = await requireCurrentUser(locals);
  const body = await request.json().catch(() => {
    throw error(400, 'Request body must be valid JSON');
  });
  const data = profileData(body);

  const profile = await prisma.sellerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
    select: profileSelect
  });

  return json({ profile });
}

export const PUT = upsertProfile;
export const POST = upsertProfile;
