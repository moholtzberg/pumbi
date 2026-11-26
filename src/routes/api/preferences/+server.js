import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { LOCALE_COOKIE, countryCode } from '$lib/utils/region.js';
export async function POST({ request, locals, cookies, url }) {
  const body = await request.json().catch(() => null);
  if (!body || !['en','he'].includes(body.locale)) throw error(400, 'Choose English or Hebrew');
  const country = body.country === undefined ? undefined : countryCode(body.country);
  if (body.country !== undefined && !country) throw error(400, 'Choose a two-letter country code');
  const session = await locals.auth?.();
  if (session?.user?.email) {
    await prisma.user.updateMany({ where: { email: session.user.email }, data: { preferredLocale: body.locale, ...(country && { country }) } });
  } else if (country) throw error(401, 'Sign in to update your country');
  cookies.set(LOCALE_COOKIE, body.locale, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 365 });
  return json({ locale: body.locale }, { headers: { 'cache-control': 'private, no-store' } });
}
