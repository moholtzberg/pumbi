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
  const document = await prisma.auctionHouseDocument.findFirst({
    where: { id: params.documentId, auctionHouseId: params.id },
    select: { id: true, cloudKey: true }
  });
  if (!document) throw error(404, 'Document not found');

  await deleteFile(document.cloudKey);
  await prisma.auctionHouseDocument.delete({ where: { id: document.id } });
  return new Response(null, { status: 204 });
}
