import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { processMarketing } from '$lib/server/marketing.js';
import { emailConfigured } from '$lib/server/smtp2go.js';
export const config = { maxDuration: 120 };
export async function POST({ request }) {
  const headers = { 'cache-control': 'no-store' };
  if (!env.CRON_SECRET || !env.AUTH_SECRET || !emailConfigured()) return json({ error: 'Marketing automation is not configured' }, { status: 503, headers });
  const digest = value => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(request.headers.get('authorization') || ''), digest(`Bearer ${env.CRON_SECRET}`))) return json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    const result = await processMarketing();
    return json(result, { status: result.failed || result.unknown ? 502 : 200, headers });
  } catch {
    console.error('Marketing automation failed');
    return json({ error: 'Marketing automation failed' }, { status: 500, headers });
  }
}
export const GET = POST;
