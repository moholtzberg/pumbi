import { error } from '@sveltejs/kit';

export function normalizeMarketingEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw error(400, 'Enter a valid email address');
  return email;
}

export function contactData(input) {
  const result = { email: normalizeMarketingEmail(input.email) };
  for (const [field, max] of [['name', 160], ['phone', 50], ['notes', 2000], ['tags', 250]]) {
    if (input[field] != null && typeof input[field] !== 'string') throw error(400, `${field} must be text`);
    const value = (input[field] || '').trim();
    if (value.length > max) throw error(400, `${field} must be ${max} characters or fewer`);
    result[field] = value || null;
  }
  return result;
}

// RFC 4180-style CSV: quoted commas, escaped quotes, BOM, CRLF and multiline cells.
export function parseContactCsv(csv) {
  if (typeof csv !== 'string' || csv.length > 2_000_000) throw error(400, 'CSV must be no larger than 2 MB');
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  const input = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === ',' || char === '\n' || char === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (char !== ',') {
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
        if (char === '\r' && input[i + 1] === '\n') i++;
      }
    } else {
      if (closed || char === '"') throw error(400, `Invalid quoting near CSV record ${rows.length + 1}`);
      cell += char;
    }
    if (rows.length > 501) throw error(400, 'Import up to 500 contacts at a time');
  }
  if (quoted) throw error(400, 'CSV contains an unclosed quoted field');
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  const headers = (rows.shift() || []).map(value => value.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const aliases = { email_address: 'email', phone_number: 'phone', full_name: 'name', first_name: 'firstName', last_name: 'lastName' };
  const fields = headers.map(value => aliases[value] || value);
  if (!fields.includes('email')) throw error(400, 'CSV needs an email column (name, phone, tags and notes are optional)');
  if (new Set(fields).size !== fields.length) throw error(400, 'CSV contains duplicate columns');
  if (!rows.length || rows.length > 500) throw error(400, 'CSV must contain 1–500 contacts');
  const contacts = new Map();
  for (const [index, values] of rows.entries()) {
    if (values.length !== fields.length) throw error(400, `CSV record ${index + 2} has the wrong number of columns`);
    const raw = Object.fromEntries(fields.map((field, i) => [field, values[i]]));
    try {
      const data = contactData({ ...raw, name: raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(' ') });
      contacts.set(data.email, data);
    } catch (err) { throw error(400, `CSV record ${index + 2}: ${err.body?.message || 'Invalid contact'}`); }
  }
  return [...contacts.values()];
}
