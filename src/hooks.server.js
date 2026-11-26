import { handle as authenticationHandle } from './auth.server.js';
import { randomUUID } from 'node:crypto';
import { browserLocale, LOCALE_COOKIE, normalizeLocale } from '$lib/utils/region.js';
import { DEVICE_COOKIE_NAME, withLoginSecurityContext } from '$lib/server/loginSecurity.js';

export async function handle(input) {
  const { event } = input;
  const selectedLocale = event.cookies.get(LOCALE_COOKIE);
  event.locals.locale = selectedLocale ? normalizeLocale(selectedLocale) : browserLocale(event.request.headers.get('accept-language') || '');
  let deviceId = event.cookies.get(DEVICE_COOKIE_NAME);
  if (!deviceId) {
    deviceId = randomUUID();
    event.cookies.set(DEVICE_COOKIE_NAME, deviceId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: event.url.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 400
    });
  }

  let clientAddress = null;
  try {
    clientAddress = event.getClientAddress();
  } catch {
    // Some local or preview adapters do not expose a client address.
  }

  return withLoginSecurityContext({ deviceId, clientAddress }, () => authenticationHandle({
    ...input,
    resolve: (event, options = {}) => input.resolve(event, {
      ...options,
      transformPageChunk: async chunk => {
        const html = options.transformPageChunk ? await options.transformPageChunk(chunk) : chunk.html;
        return html.replace('%pumbi.lang%', event.locals.locale).replace('%pumbi.dir%', event.locals.locale === 'he' ? 'rtl' : 'ltr');
      }
    })
  }));
}
