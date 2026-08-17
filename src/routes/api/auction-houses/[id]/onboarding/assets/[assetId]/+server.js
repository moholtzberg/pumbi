import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { deleteFile } from '$lib/services/cloudStorage.js';
import {
  getEditableHouse,
  requireHouseEditor
} from '$lib/server/auctionHouseOnboarding.js';

export async function DELETE({ params, locals }) {
  await requireHouseEditor(locals, params.id);
  await getEditableHouse(params.id);
  const asset = await prisma.auctionHouseAsset.findFirst({
    where: { id: params.assetId, auctionHouseId: params.id },
    select: { id: true, cloudKey: true }
  });
  if (!asset) throw error(404, 'Asset not found');

  await deleteFile(asset.cloudKey);
  await prisma.auctionHouseAsset.delete({ where: { id: asset.id } });
  return new Response(null, { status: 204 });
}
