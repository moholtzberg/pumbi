import { createHash, createHmac } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { isIP } from 'node:net';
import { env } from '$env/dynamic/private';
import prisma from '$lib/prisma.js';

export const DEVICE_COOKIE_NAME = 'pumbi_device_id';
const requestSecurityContext = new AsyncLocalStorage();

export function withLoginSecurityContext(context, callback) {
  return requestSecurityContext.run(context, callback);
}

function limited(value, length) {
  if (!value) return null;
  return String(value).trim().slice(0, length) || null;
}

function decodeHeader(value) {
  if (!value) return null;
  try {
    return limited(decodeURIComponent(value), 120);
  } catch {
    return limited(value, 120);
  }
}

function cookieValue(header, name) {
  const entry = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return null;
  }
}

function normalizeIp(value) {
  let candidate = value?.split(',')[0]?.trim();
  if (!candidate) return null;
  if (candidate.startsWith('[')) candidate = candidate.slice(1, candidate.indexOf(']'));
  if (!isIP(candidate) && /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(':'));
  }
  return isIP(candidate) ? candidate : null;
}

function fingerprint(value) {
  if (!value) return null;
  return env.AUTH_SECRET
    ? createHmac('sha256', env.AUTH_SECRET).update(value).digest('hex')
    : createHash('sha256').update(value).digest('hex');
}

export function securityRequestDetails(request) {
  const headers = request.headers;
  const context = requestSecurityContext.getStore();
  const ipAddress = normalizeIp(
    context?.clientAddress || headers.get('cf-connecting-ip') || headers.get('x-real-ip') || headers.get('x-forwarded-for')
  );
  const deviceId = context?.deviceId || cookieValue(headers.get('cookie'), DEVICE_COOKIE_NAME);
  const countryCode = limited(headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry'), 2)?.toUpperCase() || null;

  return {
    deviceIdHash: fingerprint(deviceId),
    ipAddress,
    ipHash: fingerprint(ipAddress),
    countryCode,
    region: decodeHeader(headers.get('x-vercel-ip-country-region')),
    city: decodeHeader(headers.get('x-vercel-ip-city')),
    userAgent: limited(headers.get('user-agent'), 512)
  };
}

export async function recordLoginSecurityEvent({ request, userId = null, attemptedEmail = null, outcome }) {
  try {
    const normalizedEmail = typeof attemptedEmail === 'string' ? attemptedEmail.trim().toLowerCase().slice(0, 320) : null;
    let linkedUserId = userId;
    if (!linkedUserId && normalizedEmail) {
      linkedUserId = (await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }))?.id || null;
    }

    await prisma.loginSecurityEvent.create({
      data: {
        userId: linkedUserId,
        attemptedEmail: normalizedEmail,
        outcome,
        ...securityRequestDetails(request)
      }
    });
  } catch (securityError) {
    // Security telemetry must never prevent a legitimate sign-in.
    console.error('Unable to record login security event:', securityError);
  }
}
