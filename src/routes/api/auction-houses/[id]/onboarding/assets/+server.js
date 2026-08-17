import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { deleteFile, uploadFile } from '$lib/services/cloudStorage.js';
import {
  assetMetadata,
  getEditableHouse,
  requireHouseEditor,
  requireHouseMember,
  safeUploadName,
  validateFileSignature,
  validateUpload
} from '$lib/server/auctionHouseOnboarding.js';

const ASSET_TYPES = new Set(['LOGO', 'BANNER', 'BRAND_GUIDE', 'OTHER']);
const VISIBILITIES = new Set(['PUBLIC', 'PRIVATE']);

export async function GET({ params, locals }) {
  await requireHouseMember(locals, params.id);
  const exists = await prisma.auctionHouse.findUnique({
    where: { id: params.id },
    select: { id: true }
  });
  if (!exists) throw error(404, 'Auction house not found');
  const assets = await prisma.auctionHouseAsset.findMany({
    where: { auctionHouseId: params.id },
    orderBy: { createdAt: 'desc' }
  });
  return json({ assets: await Promise.all(assets.map((asset) => assetMetadata(asset, true))) });
}

export async function POST({ params, request, locals }) {
  await requireHouseEditor(locals, params.id);
  await getEditableHouse(params.id);
  const form = await request.formData();
  const file = form.get('file');
  validateUpload(file);
  const type = form.get('type');
  const visibility = form.get('visibility') || 'PRIVATE';
  if (!ASSET_TYPES.has(type)) throw error(400, 'Invalid asset type');
  if (!VISIBILITIES.has(visibility)) throw error(400, 'Invalid asset visibility');

  const buffer = Buffer.from(await file.arrayBuffer());
  validateFileSignature(buffer, file.type);
  const folder = `auction-houses/${params.id}/onboarding/assets`;
  const uploaded = await uploadFile(buffer, safeUploadName(file), folder, file.type);

  try {
    const asset = await prisma.auctionHouseAsset.create({
      data: {
        auctionHouseId: params.id,
        type,
        visibility,
        cloudKey: uploaded.key,
        url: uploaded.url,
        fileName: file.name.slice(0, 255),
        mimeType: file.type,
        sizeBytes: file.size
      }
    });
    if (type === 'LOGO' && visibility === 'PUBLIC') {
      await prisma.auctionHouse.update({
        where: { id: params.id },
        data: { logoUrl: uploaded.key }
      });
    }
    return json({ asset: await assetMetadata(asset, true) }, { status: 201 });
  } catch (err) {
    await deleteFile(uploaded.key).catch(() => {});
    throw err;
  }
}
