import { error } from '@sveltejs/kit';
export function normalizeLotImages(images = [], { defaultPrimary = true } = {}) {
  if (!Array.isArray(images) || images.length > 100) throw error(400, 'Provide up to 100 lot images');
  const normalized = images.map((image, index) => {
    if (!image || typeof image !== 'object' || typeof image.url !== 'string') throw error(400, 'Each image needs a valid URL or storage key');
    const url = image.url.trim();
    if (!url || url.length > 8192 || !(/^(https?:\/\/|lots\/|\/uploads\/)/i.test(url)) || url.includes('..')) throw error(400, 'Each image needs a valid URL or storage key');
    const key = image.key ?? image.cloudKey ?? null;
    if (key !== null && (typeof key !== 'string' || key.length > 1000 || key.includes('..'))) throw error(400, 'Invalid image storage key');
    const displayOrder = image.displayOrder ?? index;
    if (!Number.isInteger(displayOrder) || displayOrder < 0) throw error(400, 'Image display order must be a nonnegative integer');
    return { url, cloudKey: key, displayOrder, isPrimary: image.isPrimary === true, isHidden: image.isHidden === true };
  });
  const explicitPrimary = normalized.findIndex(image => image.isPrimary);
  const primaryIndex = explicitPrimary >= 0 ? explicitPrimary : defaultPrimary ? 0 : -1;
  return normalized.map((image, index) => ({ ...image, isPrimary: index === primaryIndex }));
}
