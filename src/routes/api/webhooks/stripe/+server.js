import { error, json } from '@sveltejs/kit';
import {
  getStripe,
  getStripeWebhookSecret,
  syncConnectedAccount
} from '$lib/server/stripe.js';
import {
  syncCardCheckoutSession,
  syncIdentitySession,
  syncSellerConnectedAccount
} from '$lib/server/verification.js';

export async function POST({ request }) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) throw error(400, 'Missing Stripe signature');

  const payload = Buffer.from(await request.arrayBuffer());
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret()
    );
  } catch (err) {
    console.warn('Rejected Stripe webhook signature', err?.message);
    throw error(400, 'Invalid Stripe webhook signature');
  }

  try {
    if (event.type === 'account.updated') {
      await Promise.all([
        syncConnectedAccount(event.data.object),
        syncSellerConnectedAccount(event.data.object)
      ]);
    }
    if (event.type === 'identity.verification_session.verified' || event.type === 'identity.verification_session.requires_input') {
      await syncIdentitySession(event.data.object);
    }
    if (event.type === 'checkout.session.completed' && event.data.object.mode === 'setup') {
      await syncCardCheckoutSession(event.data.object.id);
    }
    return json({ received: true });
  } catch (err) {
    console.error(`Failed to process Stripe webhook ${event.id}`, err);
    throw error(500, 'Stripe webhook processing failed');
  }
}
