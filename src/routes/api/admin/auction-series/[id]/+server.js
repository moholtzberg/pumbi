import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { adminError, requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { _seriesData } from '../+server.js';

export async function PUT({ params, request, locals }) {
  await requirePlatformAdmin(locals);
  try {
    const existing = await prisma.auctionSeries.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) throw error(404, 'Auction series not found');

    const updated = await prisma.auctionSeries.update({
      where: { id: params.id },
      data: _seriesData(await request.json()),
      include: { auctionHouse: { select: { id: true, name: true } } }
    });
    return json(updated);
  } catch (err) {
    adminError(err, 'Failed to update auction series');
  }
}
