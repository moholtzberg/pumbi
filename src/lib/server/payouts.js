import { error } from '@sveltejs/kit';

export const PAYOUT_HOUSE_ROLES = ['OWNER', 'ADMIN', 'FINANCE'];

function requiredText(value, field, maxLength) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw error(400, `${field} is required`);
  if (result.length > maxLength) throw error(400, `${field} is too long`);
  return result;
}

export function amountToMinorUnits(value) {
  const amount = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
    throw error(400, 'Amount must be a positive value with at most two decimal places');
  }

  const [whole, fraction = ''] = amount.split('.');
  const minorUnits = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
    throw error(400, 'Amount is outside the supported range');
  }
  return minorUnits;
}

export function parsePayoutRequest(data) {
  const amount = requiredText(
    typeof data?.amount === 'number' ? String(data.amount) : data?.amount,
    'Amount',
    20
  );
  amountToMinorUnits(amount);

  const currency = requiredText(data?.currency, 'Currency', 3).toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    throw error(400, 'Currency must be a three-letter ISO currency code');
  }

  return {
    amount,
    currency,
    sourceReference: requiredText(data?.sourceReference, 'Source reference', 200),
    reason: requiredText(data?.reason, 'Reason', 1000)
  };
}

export function assertHousePayoutReady(house) {
  if (house.onboardingStatus !== 'APPROVED') {
    throw error(409, 'Auction house must be approved before requesting payouts');
  }
  if (!house.stripeConnectAccountId || !house.stripeConnectPayoutsEnabled) {
    throw error(409, 'Stripe onboarding must be complete with payouts enabled');
  }
}

export function stripeErrorMessage(err) {
  const message = typeof err?.message === 'string' ? err.message : 'Stripe transfer failed';
  return message.slice(0, 2000);
}
