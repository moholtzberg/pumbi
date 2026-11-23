import { error, json } from '@sveltejs/kit';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { dataError, listRecords, mutateRecord } from '$lib/server/adminData.js';

const headers = { 'cache-control': 'no-store, private' };
export async function GET({ params, url, locals }) {
  await requirePlatformAdmin(locals);
  try { return json(await listRecords(params.model, url), { headers }); } catch (err) { dataError(err); }
}
export async function POST({ params, request, locals }) {
  const actor = await requirePlatformAdmin(locals);
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw error(403, 'Cross-origin data changes are not allowed');
    const body = await request.json().catch(() => { throw error(400, 'Invalid JSON body'); });
    return json(await mutateRecord({ key: params.model, input: body.data, actor }), { status: 201, headers });
  } catch (err) { dataError(err); }
}
