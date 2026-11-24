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
