import { json, error } from '@sveltejs/kit';
import { startContentView, touchContentView } from '$lib/server/analytics.js';

export async function POST({ request, locals }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw error(400, 'Invalid JSON body');

  const action = String(body.action || 'start').toLowerCase();

  try {
    if (action === 'start') {
      const entityType = String(body.entityType || '').toUpperCase();
      const result = await startContentView({
        locals,
        entityType,
        entityId: String(body.entityId || ''),
        anonId: body.anonId ? String(body.anonId).slice(0, 80) : null,
        path: body.path,
        referrer: body.referrer,
        userAgent: request.headers.get('user-agent')
      });
      return json(result);
    }

    if (action === 'heartbeat' || action === 'end') {
      const result = await touchContentView({
        sessionKey: String(body.sessionKey || ''),
        durationMs: Number(body.durationMs) || 0,
        ended: action === 'end'
      });
      return json(result);
    }

    throw error(400, 'action must be start, heartbeat, or end');
  } catch (err) {
    if (err.status) throw error(err.status, err.message);
    console.error('Analytics error', err);
    throw error(500, 'Failed to record view');
  }
}
