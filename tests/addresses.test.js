import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyAddress, shippingDefaults, profileContactDefaults, invoiceHouseContact, shippingKey, formatAddress, stripeSellerContactDefaults } from '../src/lib/utils/addresses.js';
const user = { name: 'Moshe Buyer', firstName: 'Moshe', lastName: 'Buyer', email: 'verified@example.com', phone: '+12125551234', address: '123 Main St, Apt 2, Brooklyn, NY 11201, US' };
const home = { id: 'home', label: 'Home', name: 'Home recipient', street1: '10 Home St', street2: '', city: 'Brooklyn', state: 'NY', zip: '11201', country: 'US', phone: '+12125559876', isDefault: true, userId: 'private-id' };
const office = { ...home, id: 'office', label: 'Office', street1: '20 Office St', isDefault: false };

test('existing free-text and JSON profile addresses prefill known shipping fields', () => {
  const address = legacyAddress(user.address);
  assert.equal(address.street1, '123 Main St'); assert.equal(address.street2, 'Apt 2');
  assert.equal(address.city, 'Brooklyn'); assert.equal(address.state, 'NY'); assert.equal(address.zip, '11201');
  assert.deepEqual(legacyAddress(formatAddress(home)), { ...legacyAddress(''), street1: home.street1, city: home.city, state: home.state, zip: home.zip });
  assert.equal(legacyAddress(JSON.stringify({ ...home, password: 'secret' })).street1, home.street1);
  assert.equal(legacyAddress(JSON.stringify(home)).userId, undefined);
});
test('ambiguous legacy addresses remain intact for buyer review without guessing city or postcode', () => {
  const address = legacyAddress('Flat 1, 20 London Road, London, UK');
  assert.equal(address.street1, 'Flat 1, 20 London Road, London');
  assert.equal(address.country, 'GB'); assert.equal(address.city, ''); assert.equal(address.zip, '');
});
test('checkout uses default address, supports choosing another, and exposes only shipping fields', () => {
  const result = shippingDefaults(user, [office, home]);
  assert.equal(result.selectedAddressId, 'home'); assert.equal(result.address.street1, home.street1);
  assert.equal(result.address.email, user.email); assert.equal(result.address.phone, home.phone);
  assert.equal(result.address.userId, undefined); assert.equal(result.address.id, undefined);
  assert.equal(shippingDefaults(user, [office]).selectedAddressId, 'office');
  assert.equal(shippingDefaults(user).address.street1, '123 Main St');
});
test('invoice destination takes precedence over profile changes, but empty shipment shells use profile', () => {
  const destination = { toStreet1: '99 Previous St', toCity: 'Albany', toState: 'NY', toZip: '12201', toCountry: 'US', toName: 'Original buyer' };
  const result = shippingDefaults(user, [home, office], destination);
  assert.equal(result.address.street1, destination.toStreet1); assert.equal(result.address.name, destination.toName);
  assert.equal(result.selectedAddressId, 'custom');
  assert.equal(shippingDefaults(user, [home], { shippoRateId: null }).selectedAddressId, 'home');
});
test('shipping destination changes invalidate a quoted address key', () => {
  const address = shippingDefaults(user, [home]).address;
  assert.equal(shippingKey({ ...address, extra: 'ignored' }), shippingKey(address));
  for (const field of ['street1','street2','city','state','zip','country','name','phone','email']) assert.notEqual(shippingKey({ ...address, [field]: 'different' }), shippingKey(address));
});
test('onboarding defaults use profile contact and structured address without changing verification', () => {
  const defaults = profileContactDefaults(user, [home]);
  assert.equal(defaults.company.contactEmail, user.email); assert.equal(defaults.company.contactPhone, user.phone);
  assert.equal(defaults.company.contactFirstName, 'Moshe'); assert.equal(defaults.location.addressLine1, home.street1);
  assert.equal(defaults.location.contactEmail, user.email); assert.equal(defaults.seller.address, formatAddress(home));
  assert.equal(profileContactDefaults(user).seller.address, user.address);
  assert.equal(user.email, 'verified@example.com');
});
test('invoice house contact prefers headquarters and excludes internal settings and provider secrets', () => {
  const contact = invoiceHouseContact({ id: 'house', name: 'House', contactEmail: 'office@example.com', contactPhone: '123', stripeConnectAccountId: 'secret', settings: { addressInEnglish: 'old', privateSecret: 'secret' }, locations: [
    { type: 'WAREHOUSE', isPrimary: true, addressLine1: 'Warehouse' },
    { type: 'HEADQUARTERS', addressLine1: 'HQ St', city: 'Brooklyn', stateProvince: 'NY', postalCode: '11201', country: 'US' }
  ] });
  assert.match(contact.address, /^HQ St/); assert.equal(contact.email, 'office@example.com');
  assert.deepEqual(Object.keys(contact).sort(), ['address','email','id','name','phone','website']);
  assert.equal(invoiceHouseContact({ name: 'No address' }).address, '');
  assert.equal(invoiceHouseContact({ settings: JSON.stringify({ addressInEnglish: 'Recorded office', email: 'office@example.com', phone: '555' }) }).address, 'Recorded office');
});
test('Stripe individual prefill uses editable seller overrides and buyer defaults for missing fields', () => {
  const defaults = stripeSellerContactDefaults(user, { businessType: 'INDIVIDUAL' }, [home]);
  assert.equal(defaults.email, user.email); assert.equal(defaults.individual.email, user.email);
  assert.equal(defaults.individual.address.line1, home.street1); assert.equal(defaults.individual.phone, user.phone);
  assert.equal(defaults.individual.first_name, 'Moshe'); assert.equal(defaults.company, undefined);
  const custom = stripeSellerContactDefaults(user, { contactEmail: 'seller@example.com', contactPhone: '+12125550000', address: '1 Seller St, Albany, NY 12201' });
  assert.equal(custom.email, 'seller@example.com'); assert.equal(custom.individual.address.city, 'Albany');
  const business = stripeSellerContactDefaults(user, { businessType: 'BUSINESS', legalName: 'Seller LLC' }, [home]);
  assert.equal(business.company.name, 'Seller LLC'); assert.equal(business.company.address.line1, home.street1); assert.equal(business.individual, undefined);
});
