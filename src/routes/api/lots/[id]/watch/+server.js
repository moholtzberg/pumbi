import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser } from '$lib/server/authorization.js';

async function requireVisibleLot(id) {
  const lot = await prisma.lot.findUnique({
    where: { id },
    select: { id: true, isReady: true }
  });
  if (!lot || !lot.isReady) throw error(404, 'Lot not found');
  return lot;
}

export async function GET({ params, locals }) {
  const user = await requireAuthenticatedUser(locals);
  await requireVisibleLot(params.id);
  const watch = await prisma.lotWatch.findUnique({
    where: { userId_lotId: { userId: user.id, lotId: params.id } },
    select: { id: true }
  });
  return json({ watching: Boolean(watch) });
}

export async function POST({ params, locals }) {
  const user = await requireAuthenticatedUser(locals);
  await requireVisibleLot(params.id);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.lotWatch.findUnique({
      where: { userId_lotId: { userId: user.id, lotId: params.id } },
      select: { id: true }
    });
    if (!existing) {
      await tx.lotWatch.create({ data: { userId: user.id, lotId: params.id } });
    }
    const watchersCount = await tx.lotWatch.count({ where: { lotId: params.id } });
    await tx.lot.update({ where: { id: params.id }, data: { watchersCount } });
    return { watching: true, watchersCount };
  }, { isolationLevel: 'Serializable' });

  return json(result, { status: 201 });
}

export async function DELETE({ params, locals }) {
  const user = await requireAuthenticatedUser(locals);
  await requireVisibleLot(params.id);

  const result = await prisma.$transaction(async (tx) => {
    await tx.lotWatch.deleteMany({ where: { userId: user.id, lotId: params.id } });
    const watchersCount = await tx.lotWatch.count({ where: { lotId: params.id } });
    await tx.lot.update({ where: { id: params.id }, data: { watchersCount } });
    return { watching: false, watchersCount };
  }, { isolationLevel: 'Serializable' });

  return json(result);
}
