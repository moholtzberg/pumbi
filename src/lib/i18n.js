import additionalHebrew from './locales/he.js';
import interfaceHebrew from './locales/he-ui.js';
import adminHebrew from './locales/he-admin.js';
import { normalizeLocale } from './utils/region.js';
const he = {
  'Auctions': 'מכירות פומביות', 'Most watched': 'הנצפים ביותר', 'Popular auctions': 'מכירות פופולריות', 'Active lots': 'פריטים פעילים',
  'Buyer dashboard': 'אזור הקונה', 'Seller dashboard': 'אזור המוכר', 'Sold & shipping': 'מכירות ומשלוחים', 'Bidders': 'מציעים', 'Marketing & contacts': 'שיווק ואנשי קשר', 'House settings': 'הגדרות בית המכירות', 'Team': 'צוות', 'Banking': 'בנקאות ותשלומים', 'Sell with Pumbi': 'מכירה ב־Pumbi', 'Admin': 'ניהול', 'Sign out': 'יציאה', 'Sign in': 'כניסה',
  'Country': 'מדינה', 'Israel': 'ישראל', 'United States': 'ארצות הברית', 'Language': 'שפה', 'Save': 'שמירה', 'Cancel': 'ביטול', 'Edit': 'עריכה', 'Delete': 'מחיקה',
  'First Name': 'שם פרטי', 'Last Name': 'שם משפחה', 'Phone Number': 'מספר טלפון', 'Address': 'כתובת', 'Email': 'דוא״ל', 'Phone': 'טלפון', 'Profile': 'פרופיל',
  'Country / payout country': 'מדינה / מדינת קבלת התשלום',
  'Stripe Checkout and identity checks open in a language supported by Stripe. Hebrew is available on Pumbi.': 'התשלום ובדיקות הזהות נפתחים בשפה הנתמכת על ידי Stripe. עברית זמינה ב־Pumbi.',
  'Israeli payouts require provider activation. Contact Pumbi to enable an approved Israeli payout route; do not enter a US address or tax ID.': 'קבלת תשלומים בישראל דורשת הפעלה אצל ספק התשלומים. יש לפנות ל־Pumbi להפעלת מסלול מאושר לישראל. אין להזין כתובת או מספר מס אמריקאיים.',
  'Country cannot be changed after payout onboarding starts.': 'לא ניתן לשנות את המדינה לאחר תחילת רישום חשבון התשלומים.',
  'Tax identity and payout bank': 'פרטי זיהוי לצורכי מס וחשבון לקבלת תשלומים',
  'Individual (local ID / tax number)': 'אדם פרטי (תעודת זהות / מספר מס מקומי)', 'Business (company / tax number)': 'עסק (ח״פ / מספר עוסק)',
  'Use your actual country and local identity or business details. The payment provider determines the documents and bank details required for that country.': 'יש לבחור את המדינה האמיתית ולהשתמש בפרטי הזיהוי או העסק המקומיים. ספק התשלומים קובע אילו מסמכים ופרטי בנק נדרשים למדינה זו.',
  'Street': 'רחוב ומספר בית', 'City': 'עיר', 'State / province': 'מדינה / מחוז (לא חובה בישראל)', 'Postal code': 'מיקוד', 'Apartment / suite': 'דירה / יחידה', 'Recipient name': 'שם הנמען',
};
const hebrew = { ...adminHebrew, ...interfaceHebrew, ...additionalHebrew, ...he };
const lookupKey = text => String(text).trim().replace(/\s+/g, ' ').toLowerCase();
const caseInsensitiveHebrew = new Map(Object.entries(hebrew).map(([key, value]) => [lookupKey(key), value]));
export const hasHebrewTranslation = text => caseInsensitiveHebrew.has(lookupKey(text));
export function translate(locale, text, values = {}) {
  if (typeof text !== 'string') return text;
  const template = normalizeLocale(locale) === 'he' ? (Object.hasOwn(hebrew, text) ? hebrew[text] : caseInsensitiveHebrew.get(lookupKey(text))) || text : text;
  return template.replace(/\{(\w+)\}/g, (match, key) => values?.[key] == null ? match : String(values[key]));
}
