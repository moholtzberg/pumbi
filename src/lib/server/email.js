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
  const format = value => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: (invoice.currency || 'usd').toUpperCase()
  }).format(Number(value || 0));
  const house = invoice.auctionHouse.name;
  const status = invoice.status.replaceAll('_', ' ').toLowerCase();
  const payable = ['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'].includes(invoice.status);
  const shippingPending = payable && invoice.buyerPaysShipping && !invoice.shipment?.shippoRateId;
  const lines = [
    `Hello ${invoice.buyer.name || 'there'},`,
    `${house} has sent you invoice ${invoice.number}.`,
    `Auction: ${invoice.auction.title}`,
    `Lot #${invoice.lot.lotNumber}: ${invoice.lot.title}`,
    `Hammer price: ${format(invoice.hammerPrice)}`,
    `Buyer premium: ${format(invoice.buyerPremiumAmount)}`,
    shippingPending ? 'Shipping: calculated when you choose a shipping option' : `Shipping: ${format(invoice.shippingAmount)}`,
    `${shippingPending ? 'Current total before shipping' : 'Invoice total'}: ${format(invoice.totalAmount)}`,
    `Payment status: ${status}`,
    payable ? 'Sign in with this email address to view your invoice, choose shipping if required, and see payment options.'
      : 'This is a copy of your invoice. You can sign in to view its current status.'
  ];
  return sendTransactionalEmail({
    to: invoice.buyer.email,
    subject: `Invoice ${invoice.number} from ${house}`,
    text: `${lines.join('\n\n')}\n\nView invoice: ${invoiceUrl}`,
    html: `<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#1a2821"><p>Pumbi · ${escape(house)}</p><h1 style="font-size:24px">Invoice ${escape(invoice.number)}</h1>${lines.map(line => `<p>${escape(line)}</p>`).join('')}<p><a href="${escape(invoiceUrl)}" style="display:inline-block;padding:14px 20px;background:#18372f;color:white;text-decoration:none">${payable ? 'View invoice &amp; payment options' : 'View invoice'}</a></p></div>`
  });
}
