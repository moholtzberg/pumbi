import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { adminModels, dataError, listRecords } from '$lib/server/adminData.js';

export async function load({ params, url, locals }) {
  await requirePlatformAdmin(locals);
  try {
    return { ...await listRecords(params.model, url), collections: adminModels.map(model => ({ key: model.key, label: model.label })) };
  } catch (err) { dataError(err); }
}
