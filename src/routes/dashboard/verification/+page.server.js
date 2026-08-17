import { redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  publicVerification,
  refreshBuyerVerification,
  refreshIdentityForUser,
  refreshSellerForUser,
  syncCardCheckoutSession,
  verificationUserSelect
} from '$lib/server/verification.js';

export async function load({ locals, url }) {
  const session = await locals.auth?.();
  if (!session?.user?.email) throw redirect(302, '/auth/login?redirect=/dashboard/verification');
  let user = await prisma.user.findUnique({ where: { email: session.user.email }, select: verificationUserSelect });
  if (!user) throw redirect(302, '/auth/login?redirect=/dashboard/verification');

  let notice = null;
  const checkoutSessionId = url.searchParams.get('stripe_session_id');
  if (checkoutSessionId) {
    const updated = await syncCardCheckoutSession(checkoutSessionId, user.id);
    notice = updated?.id === user.id ? 'Your card was verified.' : 'We could not confirm that card setup.';
  }
  if (url.searchParams.get('identity') === 'return' && user.stripeIdentitySessionId) {
    await refreshIdentityForUser(user);
    notice = 'Your identity check was received. Stripe may need a moment to finish reviewing it.';
  }
  if (url.searchParams.get('seller') === 'return') {
    await refreshSellerForUser(user.id);
    notice = 'Your seller banking and tax details were received from Stripe.';
  }

  user = await refreshBuyerVerification(user.id);
  return { verification: publicVerification(user), notice };
}
