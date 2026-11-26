import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { countryCode } from '$lib/utils/region.js';
import { translate } from '$lib/i18n.js';
export const ISRAEL_PAYOUT_SETUP = 'Israeli payouts require provider activation. Contact Pumbi to enable an approved Israeli payout route; do not enter a US address or tax ID.';
export function israelConnectEnabled() {
  return ['full', 'recipient'].includes(env.STRIPE_ISRAEL_CONNECT_AGREEMENT);
}
export function connectCountryParams(value, locale = 'en') {
  const country = countryCode(value);
  if (!country) throw error(400, 'Choose your actual two-letter country code');
  if (country !== 'IL') return { country };
  if (!israelConnectEnabled()) throw error(409, translate(locale, ISRAEL_PAYOUT_SETUP));
  return { country, ...(env.STRIPE_ISRAEL_CONNECT_AGREEMENT === 'recipient' ? { tos_acceptance: { service_agreement: 'recipient' } } : {}) };
}
export function payoutAvailability(country, accountId) {
  const requiresActivation = countryCode(country) === 'IL' && !accountId && !israelConnectEnabled();
  return { country: countryCode(country), onboardingAvailable: !requiresActivation, requiresActivation, message: requiresActivation ? ISRAEL_PAYOUT_SETUP : null };
}
