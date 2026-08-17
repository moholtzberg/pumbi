import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { adminError, requirePlatformAdmin } from '$lib/server/platformAdmin.js';

export async function POST({ params, locals }) {
  await requirePlatformAdmin(locals);

  try {
    const policy = await prisma.$transaction(async (tx) => {
      const existing = await tx.platformPolicy.findUnique({ where: { id: params.id } });
      if (!existing) throw error(404, 'Platform policy not found');

      const now = new Date();
      await tx.platformPolicy.updateMany({
        where: { isActive: true, id: { not: params.id } },
        data: { isActive: false, effectiveTo: now }
      });

      return tx.platformPolicy.update({
        where: { id: params.id },
        data: { isActive: true, effectiveFrom: now, effectiveTo: null }
      });
    }, { isolationLevel: 'Serializable' });

    return json(policy);
  } catch (err) {
    adminError(err, 'Failed to activate platform policy');
  }
}
