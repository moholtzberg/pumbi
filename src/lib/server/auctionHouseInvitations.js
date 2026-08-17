import { createHash, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeInvitationEmail(email) {
  return email.trim().toLowerCase();
}

export function hashInvitationToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createInvitationToken() {
  return randomBytes(32).toString('hex');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function deliverAuctionHouseInvitation({
  email,
  firstName,
  auctionHouseName,
  role,
  inviteUrl
}) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return { delivery: 'manual' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: `Invitation to join ${auctionHouseName}`,
      html: `<p>Hello ${escapeHtml(firstName)},</p>
<p>You have been invited to join <strong>${escapeHtml(auctionHouseName)}</strong> as ${escapeHtml(role)}.</p>
<p><a href="${escapeHtml(inviteUrl)}">Review and accept your invitation</a></p>
<p>This invitation expires in 7 days.</p>`
    })
  });

  if (!response.ok) {
    throw new Error(`Invitation email delivery failed with status ${response.status}`);
  }

  return { delivery: 'sent' };
}
