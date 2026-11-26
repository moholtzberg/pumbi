import test from 'node:test';
import assert from 'node:assert/strict';
import { browserLocale, normalizeLocale, countryCode, normalizeRegionalPhone, auctionCurrency, formatMoney } from '../src/lib/utils/region.js';
import { legacyAddress, formatAddress, shippingDefaults, stripeSellerContactDefaults } from '../src/lib/utils/addresses.js';
import { translate } from '../src/lib/i18n.js';

test('Hebrew language negotiation respects browser quality preferences and legacy iw tags', () => {
  assert.equal(browserLocale('en-US;q=0.9,he-IL;q=0.8'), 'en');
  assert.equal(browserLocale('he-IL,en;q=0.8'), 'he');
  assert.equal(browserLocale('fr,iw;q=0.9,en;q=0'), 'he');
  assert.equal(browserLocale('he;q=0,en'), 'en');
  assert.equal(normalizeLocale('he-IL'), 'he'); assert.equal(normalizeLocale('iw'), 'he');
});
test('country is independent of UI language and accepts Israeli country names', () => {
  assert.equal(countryCode('ישראל'), 'IL'); assert.equal(countryCode('Israel'), 'IL');
  assert.equal(countryCode(' il '), 'IL'); assert.equal(countryCode('invalid'), null);
  assert.equal(translate('he', 'Buyer dashboard'), 'אזור הקונה');
  assert.equal(translate('en', 'Buyer dashboard'), 'Buyer dashboard');
  assert.equal(translate('he', 'Unknown stored business name'), 'Unknown stored business name');
});
test('Israeli mobile and landline numbers normalize to +972 without a trunk zero', () => {
  assert.equal(normalizeRegionalPhone('050-123-4567', 'IL'), '+972501234567');
  assert.equal(normalizeRegionalPhone('02-1234567', 'IL'), '+97221234567');
  assert.equal(normalizeRegionalPhone('972501234567', 'IL'), '+972501234567');
  assert.equal(normalizeRegionalPhone('00972501234567', 'IL'), '+972501234567');
  assert.equal(normalizeRegionalPhone('+972 50 123 4567', 'US'), '+972501234567');
  assert.equal(normalizeRegionalPhone('(212) 555-1234', 'US'), '+12125551234');
  assert.throws(() => normalizeRegionalPhone('2125551234', 'IL'));
  assert.throws(() => normalizeRegionalPhone('call me 0501234567', 'IL'));
  assert.equal(normalizeRegionalPhone(null, 'IL'), null);
});
test('Hebrew addresses preserve Unicode and parse Israeli city and seven-digit postal codes', () => {
  const input = { street1: 'הרצל 10', street2: 'דירה 2', city: 'תל אביב', zip: '6100001', country: 'IL' };
  const parsed = legacyAddress(formatAddress(input));
  for (const key of ['street1','street2','city','zip','country']) assert.equal(parsed[key], input[key]);
  assert.equal(parsed.state, '');
  assert.equal(legacyAddress('יפו 20, ירושלים 9438302, ישראל').country, 'IL');
  assert.equal(legacyAddress('יפו 20, ירושלים 9438302, ישראל').city, 'ירושלים');
  assert.equal(shippingDefaults({ country: 'IL' }).address.country, 'IL');
  const params = stripeSellerContactDefaults({ email: 'israel@example.com', country: 'IL' }, { country: 'IL', address: formatAddress(input), businessType: 'INDIVIDUAL' });
  assert.equal(params.individual.address.country, 'IL'); assert.equal(params.individual.address.line1, input.street1); assert.equal(params.individual.address.state, undefined);
});
test('auction currency is explicit and does not change when house currency changes', () => {
  assert.equal(auctionCurrency({ currency: 'ils' }, { settings: '{"defaultCurrency":"USD"}' }), 'ils');
  assert.equal(auctionCurrency({}, { settings: '{"defaultCurrency":"ILS"}' }), 'ils');
  assert.equal(auctionCurrency({}, { country: 'IL' }), 'ils');
  assert.equal(auctionCurrency({ currency: 'usd' }, { country: 'IL' }), 'usd');
  assert.equal(auctionCurrency({}, {}), 'usd');
  assert.throws(() => auctionCurrency({ currency: 'FAKE' }));
  assert.match(formatMoney(123.45, 'ils', 'he'), /₪/);
});
