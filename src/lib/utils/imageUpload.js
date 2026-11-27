// Keep each multipart request comfortably below the hosting request-body limit.
export const MAX_UPLOAD_IMAGE_BYTES = 3_500_000;
export const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;

export async function prepareUploadImage(file) {
  if (!file?.size) throw new Error('Choose an image to upload');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('Images must be 12 MB or smaller');
  if (file.size <= MAX_UPLOAD_IMAGE_BYTES) return file;
  let image;
  try {
    image = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    let size = Math.min(2560, Math.max(image.width, image.height));
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    for (let attempt = 0; attempt < 5; attempt++) {
      const ratio = Math.min(1, size / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, type, Math.max(0.65, 0.9 - attempt * 0.06)));
      if (blob && blob.size <= MAX_UPLOAD_IMAGE_BYTES) {
        const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: blob.type });
      }
      size = Math.round(size * 0.75);
    }
    throw new Error('This image is too large to upload. Choose a smaller image.');
  } catch (err) {
    if (err.message?.startsWith('This image is too large')) throw err;
    throw new Error('Unable to prepare this photo. Choose a JPEG, PNG, or WebP image.');
  } finally { image?.close?.(); }
}

// A fetch-compatible response lets existing single/bulk editors use the same pipeline.
// Successful images are included on partial failure so callers can keep their progress.
export async function uploadImageForm(form, { fetcher = fetch, prepare = prepareUploadImage } = {}) {
  const uploaded = [];
  const result = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    const files = form.getAll('files');
    if (!files.length) return result({ error: 'Choose an image to upload', images: [] }, 400);
    for (const original of files) {
      const file = await prepare(original);
      const single = new FormData();
      for (const [key, value] of form) if (key !== 'files') single.append(key, value);
      single.append('files', file);
      const response = await fetcher('/api/upload/image', { method: 'POST', credentials: 'include', body: single });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return result({ ...body, images: uploaded, error: body.error || body.message || (response.status === 413 ? 'This image is too large to upload. Choose a smaller image.' : 'Failed to upload images') }, response.status);
      if (!body.images?.length) return result({ error: 'No images returned from upload', images: uploaded }, 502);
      uploaded.push(...body.images);
    }
    return result({ images: uploaded }, 201);
  } catch (err) { return result({ error: err.message || 'Failed to upload images', images: uploaded }, 400); }
}
