import { countryCode } from './region.js';
export const blankAddress = () => ({ name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'US', phone: '', email: '' });
export function formatAddress(address) {
  return [address.street1, address.street2, [address.city, address.state, address.zip].filter(Boolean).join(', '), address.country].filter(Boolean).join('\n');
}
export function legacyAddress(value, country = 'US') {
  const result = { ...blankAddress(), country: countryCode(country) || 'US' };
  if (!value?.trim()) return result;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.street1) return { ...result, ...Object.fromEntries(Object.keys(result).filter(key => typeof parsed[key] === 'string').map(key => [key, parsed[key]])) };
  } catch { /* Existing free-text profile addresses are supported below. */ }
  const parts = value.split(/[\n,]+/).map(part => part.trim()).filter(Boolean);
  const countries = { US: 'US', USA: 'US', 'UNITED STATES': 'US', UK: 'GB', GB: 'GB', 'UNITED KINGDOM': 'GB', CANADA: 'CA', CA: 'CA', ISRAEL: 'IL', IL: 'IL', 'ישראל': 'IL' };
  if (parts.length > 1 && countries[parts.at(-1).toUpperCase()]) result.country = countries[parts.pop().toUpperCase()];
  if (/^\d{5}(?:-\d{4})?$/.test(parts.at(-1)) && /^[A-Za-z]{2}$/.test(parts.at(-2))) parts.splice(-2, 2, parts.at(-2) + ' ' + parts.at(-1));
  const region = parts.at(-1)?.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (region && parts.length >= 3) {
    parts.pop(); result.state = region[1].toUpperCase(); result.zip = region[2]; result.city = parts.pop();
    result.street1 = parts.shift(); result.street2 = parts.join(', ');
  } else if (result.country === 'IL' && parts.length >= 2) {
    const postal = parts.at(-1).match(/^(.*?)\s*(\d{7})$/);
    if (postal) { result.zip = postal[2]; if (postal[1].trim()) parts[parts.length - 1] = postal[1].trim(); else parts.pop(); }
    if (parts.length >= 2) { result.city = parts.pop(); result.street1 = parts.shift(); result.street2 = parts.join(', '); }
    else result.street1 = parts.join(', ');
  } else result.street1 = parts.join(', ');
  return result;
}
export function shippingDefaults(user, addresses = [], shipment = null) {
  const primary = addresses.find(address => address.isDefault) || addresses[0];
  const stored = primary || legacyAddress(user.address, user.country);
  if (!primary && !user.address && countryCode(user.country)) stored.country = countryCode(user.country);
  const base = { ...blankAddress(), ...Object.fromEntries(Object.keys(blankAddress()).filter(key => typeof stored[key] === 'string').map(key => [key, stored[key]])), name: primary?.name || user.name || '', phone: primary?.phone || user.phone || '', email: user.email || '' };
  let address = base;
  if (shipment?.toStreet1?.trim()) address = {
    name: shipment.toName || base.name, street1: shipment.toStreet1, street2: shipment.toStreet2 || '', city: shipment.toCity || '', state: shipment.toState || '', zip: shipment.toZip || '', country: shipment.toCountry || base.country, phone: shipment.toPhone || base.phone, email: shipment.toEmail || base.email
  };
  const match = addresses.find(saved => ['street1','street2','city','state','zip','country'].every(key => String(saved[key] || '').trim().toLowerCase() === String(address[key] || '').trim().toLowerCase()));
  return { address, selectedAddressId: match?.id || 'custom' };
}
export function invoiceHouseContact(house) {
  if (!house) return undefined;
  let settings = {};
  try { settings = typeof house.settings === 'string' ? JSON.parse(house.settings) : house.settings || {}; } catch { /* Use recorded contact fields. */ }
  const locations = house.locations || [];
  const location = locations.find(row => row.type === 'HEADQUARTERS' && row.isPrimary) || locations.find(row => row.type === 'HEADQUARTERS') || locations.find(row => row.isPrimary) || locations[0];
  const address = location ? formatAddress({ street1: location.addressLine1, street2: location.addressLine2, city: location.city, state: location.stateProvince, zip: location.postalCode, country: location.country }) : settings.addressInEnglish || '';
  return { id: house.id, name: house.name, address, email: house.contactEmail || location?.contactEmail || settings.email || '', phone: house.contactPhone || location?.contactPhone || settings.phone || '', website: house.website || '' };
}

export function shippingKey(address) {
  return JSON.stringify(Object.keys(blankAddress()).map(key => String(address?.[key] || '').trim()));
}

export function profileContactDefaults(user, addresses = []) {
  const address = shippingDefaults(user, addresses).address;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || '';
  return {
    company: { contactFirstName: user.firstName || name.split(' ')[0] || '', contactLastName: user.lastName || name.split(' ').slice(1).join(' '), contactEmail: user.email || '', contactPhone: user.phone || '', country: address.country },
    location: { addressLine1: address.street1, addressLine2: address.street2, city: address.city, stateProvince: address.state, postalCode: address.zip, country: address.country, contactName: name, contactEmail: user.email || '', contactPhone: user.phone || '' },
    seller: { displayName: name, legalName: name, contactEmail: user.email || '', contactPhone: user.phone || '', address: addresses.length ? formatAddress(address) : user.address || '' }
  };
}

export function stripeSellerContactDefaults(user, profile, addresses = []) {
  const saved = profile.address?.trim() ? legacyAddress(profile.address, profile.country || user.country) : shippingDefaults(user, addresses).address;
  const address = Object.fromEntries(Object.entries({ line1: saved.street1, line2: saved.street2, city: saved.city, state: saved.state, postal_code: saved.zip, country: saved.country }).filter(([, value]) => value));
  const email = profile.contactEmail || user.email;
  const phone = profile.contactPhone || user.phone;
  const contact = { ...(phone && { phone }), ...(saved.street1 && { address }) };
  return {
    email,
    ...(profile.businessType === 'BUSINESS'
      ? { company: { ...contact, ...(profile.legalName && { name: profile.legalName }) } }
      : { individual: { ...contact, email, ...(user.firstName && { first_name: user.firstName }), ...(user.lastName && { last_name: user.lastName }) } })
  };
}
