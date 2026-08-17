import { handle as authenticationHandle } from './auth.server.js';
import { randomUUID } from 'node:crypto';
import { DEVICE_COOKIE_NAME, withLoginSecurityContext } from '$lib/server/loginSecurity.js';

export async function handle(input) {
  const { event } = input;
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

  return withLoginSecurityContext({ deviceId, clientAddress }, () => authenticationHandle(input));
}
