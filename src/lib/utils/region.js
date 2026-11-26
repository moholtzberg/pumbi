export const LOCALE_COOKIE = 'pumbi_locale';
export const normalizeLocale = value => /^(he|iw)(?:-|$)/i.test(value || '') ? 'he' : 'en';
export const localeTag = locale => normalizeLocale(locale) === 'he' ? 'he-IL' : 'en-US';
export function browserLocale(header = '') {
  const choices = header.split(',').map((item, index) => {
    const [language, ...parameters] = item.trim().split(';');
    const quality = parameters.find(value => value.trim().startsWith('q='));
    return { language, quality: quality ? Number(quality.trim().slice(2)) : 1, index };
  }).filter(item => /^(en|he|iw)(?:-|$)/i.test(item.language) && item.quality > 0);
  choices.sort((a, b) => b.quality - a.quality || a.index - b.index);
  return normalizeLocale(choices[0]?.language);
}
export function countryCode(value) {
  const code = String(value || '').trim().toUpperCase();
  const aliases = { 'ישראל': 'IL', ISRAEL: 'IL', USA: 'US', 'UNITED STATES': 'US', UK: 'GB' };
  const result = aliases[code] || code;
  return /^[A-Z]{2}$/.test(result) ? result : null;
}
export function normalizeRegionalPhone(value, country = 'US') {
  if (!value) return null;
  const compact = String(value).trim().replace(/[\s().-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  if (/^00[1-9]\d{7,14}$/.test(compact)) return `+${compact.slice(2)}`;
  if (countryCode(country) === 'IL') {
    if (/^0(?:[23489]\d{7}|[57]\d{8})$/.test(compact)) return `+972${compact.slice(1)}`;
    if (/^972(?:[23489]\d{7}|[57]\d{8})$/.test(compact)) return `+${compact}`;
  } else if (['US', 'CA'].includes(countryCode(country))) {
    if (/^\d{10}$/.test(compact)) return `+1${compact}`;
    if (/^1\d{10}$/.test(compact)) return `+${compact}`;
  }
  throw new Error(countryCode(country) === 'IL' ? 'Enter an Israeli phone number such as 050-123-4567 or +972501234567' : 'Enter a phone number with its country code, such as +12125551234 or +972501234567');
}
export function readSettings(value) {
  try { const data = typeof value === 'string' ? JSON.parse(value) : value; return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; } catch { return {}; }
}
// Auction amounts use the advertised auction currency. Currency changes do not convert bids.
export function auctionCurrency(auction, house) {
  const settings = readSettings(auction?.settings);
  const houseSettings = readSettings(house?.settings);
  const value = auction?.currency || settings.currency || settings.baseCurrency || houseSettings.defaultCurrency || houseSettings.baseCurrency || houseSettings.currency || defaultCurrency(house?.country);
  const currency = String(value).toUpperCase();
  if (!['USD','ILS','EUR','GBP','CAD','AUD'].includes(currency)) throw new Error('Unsupported auction currency');
  return currency.toLowerCase();
}
export const defaultCurrency = country => countryCode(country) === 'IL' ? 'ils' : 'usd';
export const formatMoney = (amount, currency = 'usd', locale = 'en') => new Intl.NumberFormat(localeTag(locale), { style: 'currency', currency: currency.toUpperCase() }).format(Number(amount || 0));
