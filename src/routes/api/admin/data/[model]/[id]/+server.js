import { error, json } from '@sveltejs/kit';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { dataError, readRecord, mutateRecord } from '$lib/server/adminData.js';
const headers = { 'cache-control': 'no-store, private' };

export async function GET({ params, locals }) {
  await requirePlatformAdmin(locals);
  try { return json(await readRecord(params.model, params.id), { headers }); } catch (err) { dataError(err); }
}
async function change(event, deleting) {
  const { params, locals, request } = event;
  const actor = await requirePlatformAdmin(locals);
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw error(403, 'Cross-origin data changes are not allowed');
    const body = await request.json().catch(() => { throw error(400, 'Invalid JSON body'); });
    return json(await mutateRecord({ key: params.model, id: params.id, input: body.data, revision: body.revision, confirmation: body.confirmation, actor, deleting }), { headers });
  } catch (err) { dataError(err); }
}
export const PATCH = event => change(event, false);
export const DELETE = event => change(event, true);
