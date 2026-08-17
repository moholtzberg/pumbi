import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  deleteFile,
  getStorageProviderName,
  uploadFile
} from '$lib/services/cloudStorage.js';
import {
  documentMetadata,
  getEditableHouse,
  optionalString,
  parseDate,
  requireHouseEditor,
  requireHouseMember,
  safeUploadName,
  validateFileSignature,
  validateUpload,
  validateUploadRequestSize
} from '$lib/server/auctionHouseOnboarding.js';

const DOCUMENT_TYPES = new Set([
  'BUSINESS_LICENSE',
  'TAX_DOCUMENT',
  'BANK_VERIFICATION',
  'INSURANCE',
  'INCORPORATION',
  'IDENTITY',
  'OTHER'
]);

export async function GET({ params, locals }) {
  await requireHouseMember(locals, params.id);
  const exists = await prisma.auctionHouse.findUnique({
    where: { id: params.id },
    select: { id: true }
  });
  if (!exists) throw error(404, 'Auction house not found');
  const documents = await prisma.auctionHouseDocument.findMany({
    where: { auctionHouseId: params.id },
    orderBy: { createdAt: 'desc' }
  });
  return json({
    documents: await Promise.all(documents.map((document) => documentMetadata(document, true)))
  });
}

export async function POST({ params, request, locals }) {
  await requireHouseEditor(locals, params.id);
  await getEditableHouse(params.id);
  if (getStorageProviderName() !== 's3') {
    throw error(503, 'Private compliance documents require encrypted S3 storage');
  }
  validateUploadRequestSize(request);
  const form = await request.formData();
  const file = form.get('file');
  validateUpload(file);
  const type = form.get('type');
  if (!DOCUMENT_TYPES.has(type)) throw error(400, 'Invalid document type');

  const buffer = Buffer.from(await file.arrayBuffer());
  validateFileSignature(buffer, file.type);
  const folder = `auction-houses/${params.id}/onboarding/documents`;
  const uploaded = await uploadFile(buffer, safeUploadName(file), folder, file.type);

  try {
    const document = await prisma.auctionHouseDocument.create({
      data: {
        auctionHouseId: params.id,
        type,
        cloudKey: uploaded.key,
        privateUrl: uploaded.url,
        fileName: file.name.slice(0, 255),
        mimeType: file.type,
        sizeBytes: file.size,
        licenseNumber: optionalString(form.get('licenseNumber'), 'License number', 200),
        jurisdiction: optionalString(form.get('jurisdiction'), 'Jurisdiction', 200),
        expiresAt: parseDate(form.get('expiresAt'), 'Expiration date')
      }
    });
    return json({ document: await documentMetadata(document, true) }, { status: 201 });
  } catch (err) {
    await deleteFile(uploaded.key).catch(() => {});
    throw err;
  }
}
