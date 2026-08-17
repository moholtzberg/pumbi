import { error, json } from '@sveltejs/kit';
import {
  getStripe,
  getStripeWebhookSecret,
  syncConnectedAccount
} from '$lib/server/stripe.js';

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
      await syncConnectedAccount(event.data.object);
    }
    return json({ received: true });
  } catch (err) {
    console.error(`Failed to process Stripe webhook ${event.id}`, err);
    throw error(500, 'Stripe webhook processing failed');
  }
}
