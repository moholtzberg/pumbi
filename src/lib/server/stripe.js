import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import prisma from '$lib/prisma.js';

let stripeClient;

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  stripeClient ||= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
}

export function getStripeWebhookSecret() {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }
  return env.STRIPE_WEBHOOK_SECRET;
}

export function connectStatusForAccount(account) {
  const disabledReason = account.requirements?.disabled_reason || '';
  if (disabledReason.startsWith('rejected.')) return 'REJECTED';
  if (account.payouts_enabled) return 'ENABLED';
  if (account.details_submitted || disabledReason) return 'RESTRICTED';
  return 'PENDING';
}

export function publicConnectStatus(house) {
  return {
    accountId: house.stripeConnectAccountId,
    status: house.stripeConnectStatus,
    detailsSubmitted: house.stripeConnectDetailsSubmitted,
    chargesEnabled: house.stripeConnectChargesEnabled,
    payoutsEnabled: house.stripeConnectPayoutsEnabled,
    onboardingComplete: house.stripeConnectOnboardingDone
  };
}

export async function syncConnectedAccount(account) {
  if (!account || account.object !== 'account') {
    throw new Error('A Stripe account is required');
  }

  const data = {
    stripeConnectStatus: connectStatusForAccount(account),
    stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
    stripeConnectChargesEnabled: Boolean(account.charges_enabled),
    stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
    stripeConnectOnboardingDone: Boolean(account.details_submitted)
  };

  const result = await prisma.auctionHouse.updateMany({
    where: { stripeConnectAccountId: account.id },
    data
  });

  return { matched: result.count === 1, data };
}
