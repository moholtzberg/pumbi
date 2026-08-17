import { error, json } from '@sveltejs/kit';
import { requireAuthenticatedUser } from '$lib/server/authorization.js';
import {
  checkContactVerification,
  publicVerification,
  refreshBuyerVerification,
  refreshIdentityForUser,
  refreshSellerForUser,
  startCardVerification,
  startContactVerification,
  startIdentityVerification,
  startSellerConnect,
  verificationUserSelect
} from '$lib/server/verification.js';
import prisma from '$lib/prisma.js';

async function currentUser(locals) {
  const authenticated = await requireAuthenticatedUser(locals);
  const user = await prisma.user.findUnique({ where: { id: authenticated.id }, select: verificationUserSelect });
  if (!user) throw error(404, 'User not found');
  return user;
}

export async function GET({ locals }) {
  let user = await currentUser(locals);
  if (user.stripeIdentitySessionId && user.identityVerificationStatus !== 'VERIFIED') {
    try { user = await refreshIdentityForUser(user); } catch (providerError) {
      console.warn('Unable to refresh Stripe Identity status', providerError?.message);
    }
  }
  if (user.sellerProfile?.stripeConnectAccountId) {
    try { await refreshSellerForUser(user.id); } catch (providerError) {
      console.warn('Unable to refresh seller Stripe status', providerError?.message);
    }
  }
  user = await refreshBuyerVerification(user.id);
  return json(publicVerification(user));
}

export async function POST({ locals, request }) {
  const user = await currentUser(locals);
  const body = await request.json().catch(() => { throw error(400, 'Request body must be valid JSON'); });
  const origin = new URL(request.url).origin;

  try {
    switch (body.action) {
    case 'send_email':
      return json(await startContactVerification(user, 'email'));
    case 'send_phone':
      return json(await startContactVerification(user, 'sms'));
    case 'check_email':
      return json(publicVerification(await checkContactVerification(user, 'email', String(body.code || '').trim())));
    case 'check_phone':
      return json(publicVerification(await checkContactVerification(user, 'sms', String(body.code || '').trim())));
    case 'start_identity':
      return json(await startIdentityVerification(user, origin));
    case 'start_card':
      return json(await startCardVerification(user, origin));
    case 'start_seller':
      return json(await startSellerConnect(user, origin, body.businessType));
      default:
        throw error(400, 'Unknown verification action');
    }
  } catch (providerError) {
    if (providerError?.status) throw providerError;
    if (providerError?.message?.includes('STRIPE_SECRET_KEY')) {
      throw error(503, 'Stripe verification is not configured');
    }
    console.error('Verification provider request failed', providerError);
    throw error(502, 'Unable to start secure verification. Please try again.');
  }
}
