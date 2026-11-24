import { createHash, randomBytes } from 'node:crypto';
import { emailConfigured, escapeEmailHtml as escapeHtml, sendTransactionalEmail } from '$lib/server/smtp2go.js';

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

export async function deliverAuctionHouseInvitation({
  email,
  firstName,
  auctionHouseName,
  role,
  inviteUrl
}) {
  if (!emailConfigured()) return { delivery: 'manual' };

  await sendTransactionalEmail({
    to: email,
    subject: `Invitation to join ${auctionHouseName}`,
    text: `Hello ${firstName},\n\nYou have been invited to join ${auctionHouseName} as ${role}.\nReview and accept your invitation: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
    html: `<p>Hello ${escapeHtml(firstName)},</p>
<p>You have been invited to join <strong>${escapeHtml(auctionHouseName)}</strong> as ${escapeHtml(role)}.</p>
<p><a href="${escapeHtml(inviteUrl)}">Review and accept your invitation</a></p>
<p>This invitation expires in 7 days.</p>`
  });

  return { delivery: 'sent' };
}
