import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { adminModels } from '$lib/server/adminData.js';

export async function load({ locals }) {
  await requirePlatformAdmin(locals);
  return { collections: await Promise.all(adminModels.map(async model => ({ key: model.key, label: model.label, count: await prisma[model.key].count() }))) };
}
