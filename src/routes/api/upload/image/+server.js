import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { uploadFile } from '$lib/services/cloudStorage.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';
import { readUploadImage, imageFormat } from '$lib/server/uploadImages.js';
import { removeBackground as removeBackgroundService } from '$lib/services/backgroundRemoval.js';
import { requireAuthenticatedUser, requireAuctionAccess, requireAuctionHousePermission, HOUSE_PERMISSIONS } from '$lib/server/authorization.js';
export const config = { maxDuration: 120 };

export async function POST({ request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);
    const formData = await request.formData();
    const files = formData.getAll('files');
    const lotId = formData.get('lotId');
    if (lotId) {
      const lot = await prisma.lot.findUnique({ where: { id: String(lotId) }, include: { auction: true } });
      if (!lot) throw error(404, 'Lot not found');
      requireAuctionAccess(user, lot.auction);
      await requireAuctionHousePermission(user, lot.auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_CATALOG);
    }
    if (!files.length || files.length > 20) throw error(400, 'Choose between 1 and 20 images');
    // Validate the full request before uploading any bytes to storage.
    const inputs = await Promise.all(files.map(readUploadImage));
    const images = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      let { buffer, mime, extension } = inputs[index];
      let backgroundRemoved = false;
      if (formData.get('removeBackground') === 'true') {
        try {
          const result = await removeBackgroundService(file);
          if (result.success && result.image) {
            const processed = Buffer.from(result.image.split(',').at(-1).trim(), 'base64');
            const format = imageFormat(processed);
            buffer = processed; mime = format.mime; extension = format.extension;
            backgroundRemoved = true;
          }
        } catch { /* Keep the original photo if optional background processing fails. */ }
      }
      const filename = `${file.name.replace(/\.[^.]+$/, '')}.${extension}`;
      const { url, key } = await uploadFile(buffer, filename, 'lots', mime);
      images.push({ url, key, previewUrl: await convertToPresignedUrl(url), filename, size: buffer.length, type: mime, backgroundRemoved });
    }
    return json({ images }, { status: 201 });
  } catch (err) {
    if (err.status) throw err;
    console.error('Image upload failed:', err.message);
    return json({ error: err.message || 'Failed to upload images' }, { status: 503 });
  }
}
