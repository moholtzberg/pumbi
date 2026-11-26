import { error } from '@sveltejs/kit';
import { auctionSettingsSchema } from '$lib/zod.js';
import { readSettings } from '$lib/utils/region.js';
import { preserveRelistState } from '$lib/server/auctionCompletion.js';

// All settings entry points preserve auctioneer state, unknown legacy values,
// and omitted fields. Incoming runtime state is never accepted from a form.
export async function updateAuctionSettings(
  currentValue,
  patchValue,
  currency = 'usd',
) {
  const current = readSettings(currentValue);
  const patch = readSettings(patchValue);
  if (
    patch.currency &&
    String(patch.currency).toLowerCase() !== currency.toLowerCase()
  )
    throw error(
      409,
      'Auction currency is fixed at creation. Create a new auction to use a different currency.',
    );
  const merged = {
    ...current,
    ...patch,
    galleryTemplateSettings: {
      ...current.galleryTemplateSettings,
      ...patch.galleryTemplateSettings,
    },
  };
  const validated = await auctionSettingsSchema.parseAsync(merged);
  // Schema defaults describe new forms, not a request to override absent
  // inherited values during a partial save (for example house-paid shipping).
  const supplied = Object.fromEntries(
    Object.entries(validated).filter(([key]) => Object.hasOwn(merged, key)),
  );
  const result = preserveRelistState(current, { ...current, ...supplied });
  if (Object.hasOwn(current, 'onBlockLotId'))
    result.onBlockLotId = current.onBlockLotId;
  else delete result.onBlockLotId;
  result.currency = currency.toUpperCase();
  return result;
}
