import { invoiceHouseContact } from '$lib/utils/addresses.js';
import { translate } from '$lib/i18n.js';
import { localeTag, normalizeLocale } from '$lib/utils/region.js';
import { env } from '$env/dynamic/private';
import { escapeEmailHtml as escape, sendTransactionalEmail } from '$lib/server/smtp2go.js';

export async function deliverPasswordReset({ email, firstName, token, origin }) {
  // APP_URL is preferred on deployments; request origin supports local development.
  const base = new URL(env.APP_URL || origin);
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid APP_URL');
  const resetUrl = new URL('/auth/reset-password', base);
  resetUrl.searchParams.set('token', token);
  resetUrl.searchParams.set('email', email);
  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
  return sendTransactionalEmail({
    to: email,
    subject: 'Reset your Pumbi password',
    text: `${greeting}\n\nReset your Pumbi password using this link:\n${resetUrl.href}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
    html: `<p>${escape(greeting)}</p><p>Use the link below to reset your Pumbi password.</p><p><a href="${escape(resetUrl.href)}">Reset your password</a></p><p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>`
  });
}

export async function deliverBuyerInvoice({ invoice, origin }) {
  const base = new URL(env.APP_URL || origin);
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid APP_URL');
  const invoiceUrl = new URL(`/dashboard/invoices/${encodeURIComponent(invoice.id)}`, base).href;
  const locale = normalizeLocale(invoice.buyer.preferredLocale);
  const t = (text, values) => translate(locale, text, values);
  const format = value => new Intl.NumberFormat(localeTag(locale), {
    style: 'currency', currency: (invoice.currency || 'usd').toUpperCase()
  }).format(Number(value || 0));
  const contact = invoiceHouseContact(invoice.auctionHouse);
  const house = contact.name;
  const status = invoice.status.replaceAll('_', ' ').toLowerCase();
  const payable = ['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'].includes(invoice.status);
  const shippingPending = payable && invoice.buyerPaysShipping && !invoice.shipment?.shippoRateId;
  const lines = [
    t('Hello {name},', { name: invoice.buyer.name || (locale === 'he' ? 'לקוח/ה' : 'there') }),
    t('{house} has sent you invoice {number}.', { house, number: invoice.number }),
    ...[contact.address, contact.email, contact.phone].filter(Boolean),
    t('Auction: {title}', { title: invoice.auction.title }),
    t('Lot #{number}: {title}', { number: invoice.lot.lotNumber, title: invoice.lot.title }),
    t('Hammer price: {amount}', { amount: format(invoice.hammerPrice) }),
    t('Buyer premium: {amount}', { amount: format(invoice.buyerPremiumAmount) }),
    shippingPending ? t('Shipping: calculated when you choose a shipping option') : t('Shipping: {amount}', { amount: format(invoice.shippingAmount) }),
    `${t(shippingPending ? 'Current total before shipping' : 'Invoice total')}: ${format(invoice.totalAmount)}`,
    t('Payment status: {status}', { status: t(status) }),
    t(payable ? 'Sign in with this email address to view your invoice, choose shipping if required, and see payment options.'
      : 'This is a copy of your invoice. You can sign in to view its current status.')
  ];
  return sendTransactionalEmail({
    to: invoice.buyer.email,
    subject: t('Invoice {number} from {house}', { number: invoice.number, house }),
    text: `${lines.join('\n\n')}\n\n${t('View invoice')}: ${invoiceUrl}`,
    html: `<div lang="${locale}" dir="${locale === 'he' ? 'rtl' : 'ltr'}" style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#1a2821"><p>Pumbi · ${escape(house)}</p><h1 style="font-size:24px">${t('Invoice')} ${escape(invoice.number)}</h1>${lines.map(line => `<p>${escape(line)}</p>`).join('')}<p><a href="${escape(invoiceUrl)}" style="display:inline-block;padding:14px 20px;background:#18372f;color:white;text-decoration:none">${escape(t(payable ? 'View invoice & payment options' : 'View invoice'))}</a></p></div>`
  });
}
