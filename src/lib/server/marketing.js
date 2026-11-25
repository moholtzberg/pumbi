import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser, requireAuctionHousePermission, HOUSE_PERMISSIONS } from './authorization.js';
import { sendTransactionalEmail } from './smtp2go.js';
import { marketingEmail } from './marketingTemplates.js';
import { normalizeMarketingEmail } from './marketingContacts.js';

export async function requireMarketingHouse(locals, houseId, client = prisma) {
  const user = await requireAuthenticatedUser(locals);
  await requireAuctionHousePermission(user, houseId, HOUSE_PERMISSIONS.MANAGE_BIDDERS);
  await requireAuctionHousePermission(user, houseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);
  const house = await client.auctionHouse.findUnique({ where: { id: houseId }, select: { id: true, name: true, isActive: true, onboardingStatus: true } });
  if (!house) throw error(404, 'Auction house not found');
  if (!house.isActive || (house.onboardingStatus !== 'APPROVED' && user.role !== 'PLATFORM_ADMIN')) throw error(403, 'Complete auction-house onboarding before sending marketing emails');
  return house;
}

export function nextMarketingLot(auction, lots, now = new Date()) {
  let settings = {};
  try { settings = typeof auction.settings === 'string' ? JSON.parse(auction.settings) : auction.settings || {}; } catch { /* empty settings */ }
  const current = lots.find(lot => lot.id === settings?.onBlockLotId) ||
    lots.filter(lot => lot.endTime && lot.endTime > now).sort((a, b) => a.endTime - b.endTime)[0] || null;
  const next = lots.find(lot => lot.id !== current?.id && (!lot.endTime || lot.endTime <= now));
  return { current, next };
}

export async function queueInvitations(campaign, contacts, client = prisma) {
  if (!campaign.enabled) throw error(400, 'Enable this auction’s marketing emails first');
  const active = contacts.filter(contact => contact.subscribed);
  if (!active.length) return { queued: 0 };
  await client.marketingEnrollment.createMany({ data: active.map(contact => ({ campaignId: campaign.id, contactId: contact.id })), skipDuplicates: true });
  const result = await client.marketingMessage.createMany({
    data: active.map(contact => ({ auctionHouseId: campaign.auctionHouseId, campaignId: campaign.id, contactId: contact.id, email: contact.email, kind: 'INVITATION', eventKey: `${campaign.auctionId}:invitation`, subject: campaign.subject, message: campaign.message })),
    skipDuplicates: true
  });
  return { queued: result.count };
}

function recipient(user) {
  if (!user?.emailVerifiedAt) return null;
  try { return { email: normalizeMarketingEmail(user.email), recipientUserId: user.id }; } catch { return null; }
}

export async function queueCampaignReminders(campaign, { now = new Date(), client = prisma } = {}) {
  const auction = campaign.auction;
  if (!campaign.enabled || !campaign.auctionHouse.isActive || ['ENDED', 'CANCELLED'].includes(auction.status)) return;
  const untilStart = auction.startDate.getTime() - now.getTime();
  if (campaign.auctionReminders && untilStart <= campaign.reminderMinutes * 60_000 && untilStart >= -5 * 60_000) {
    const enrollments = await client.marketingEnrollment.findMany({ where: { campaignId: campaign.id, contact: { subscribed: true } }, include: { contact: true } });
    const registrations = await client.auctionRegistration.findMany({ where: { auctionId: auction.id, status: 'APPROVED' }, select: { user: { select: { id: true, email: true, emailVerifiedAt: true } } } });
    const audience = new Map();
    for (const enrollment of enrollments) audience.set(enrollment.contact.email, { email: enrollment.contact.email, contactId: enrollment.contact.id });
    for (const registration of registrations) { const target = recipient(registration.user); if (target && !audience.has(target.email)) audience.set(target.email, target); }
    if (audience.size) {
      const eventKey = `${auction.id}:start:${auction.startDate.toISOString()}`;
      await client.marketingMessage.createMany({ data: [...audience.values()].map(target => ({ ...target, auctionHouseId: campaign.auctionHouseId, campaignId: campaign.id, kind: 'AUCTION_START', eventKey })), skipDuplicates: true });
      await client.marketingMessage.updateMany({ where: { campaignId: campaign.id, eventKey, status: 'CANCELLED', error: 'Auction reminder window changed or expired' }, data: { status: 'QUEUED', error: null } });
    }
  }
  const firstLotWindow = !auction.auctioneerStartedAt && untilStart <= 5 * 60_000 && untilStart >= -5 * 60_000;
  if (!campaign.lotReminders || (!(auction.status === 'LIVE' && auction.auctioneerStartedAt) && !firstLotWindow)) return;
  const lots = await client.lot.findMany({ where: { auctionId: auction.id, isReady: true, status: 'ACTIVE' }, orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }] });
  const { current, next } = nextMarketingLot(auction, lots, now);
  // Catch current-lot watchers too if no next-up reminder was generated earlier.
  for (const lot of [current, next].filter(Boolean)) {
    const watches = await client.lotWatch.findMany({ where: { lotId: lot.id }, select: { user: { select: { id: true, email: true, emailVerifiedAt: true } } } });
    const targets = watches.map(watch => recipient(watch.user)).filter(Boolean);
    if (targets.length) {
      const eventKey = `${auction.id}:lot:${lot.id}`;
      await client.marketingMessage.createMany({ data: targets.map(target => ({ ...target, auctionHouseId: campaign.auctionHouseId, campaignId: campaign.id, lotId: lot.id, kind: 'LOT_NEXT', eventKey })), skipDuplicates: true });
      // A reordered lot can return to the front later. Sent emails remain deduplicated.
      await client.marketingMessage.updateMany({ where: { campaignId: campaign.id, eventKey, status: 'CANCELLED', error: 'Live queue changed' }, data: { status: 'QUEUED', error: null } });
    }
  }
}

// Called on lot-open as well as by the scheduler, so short lots still enter the outbox.
export async function queueLiveMarketing(auctionId, client = prisma) {
  if (!client.marketingCampaign) return; // Allows older generated clients during a rolling upgrade.
  const campaign = await client.marketingCampaign.findUnique({ where: { auctionId }, include: { auction: true, auctionHouse: true } });
  if (campaign) await queueCampaignReminders(campaign, { client });
}

export async function messageEligibility(row, { now = new Date(), client = prisma } = {}) {
  const { campaign } = row;
  const auction = campaign.auction;
  if (campaign.auctionHouseId !== row.auctionHouseId || auction.auctionHouseId !== row.auctionHouseId || (row.contact && row.contact.auctionHouseId !== row.auctionHouseId)) return { reason: 'Recipient or auction does not belong to this house' };
  if (!campaign.enabled || !campaign.auctionHouse.isActive || ['ENDED', 'CANCELLED'].includes(auction.status)) return { reason: 'Auction marketing paused or auction ended' };
  if (await client.marketingSuppression.findUnique({ where: { auctionHouseId_email: { auctionHouseId: row.auctionHouseId, email: row.email } } })) return { reason: 'Unsubscribed' };
  if (row.contactId && (!row.contact?.subscribed || row.contact.email !== row.email)) return { reason: 'Contact is no longer subscribed' };
  if (row.recipientUserId) {
    const user = await client.user.findUnique({ where: { id: row.recipientUserId }, select: { email: true, emailVerifiedAt: true } });
    if (!user?.emailVerifiedAt || normalizeMarketingEmail(user.email) !== row.email) return { reason: 'Recipient email changed or is not verified' };
  }
  if (row.kind === 'AUCTION_START') {
    const startKey = `${auction.id}:start:${auction.startDate.toISOString()}`;
    if (!campaign.auctionReminders || row.eventKey !== startKey || now < new Date(auction.startDate.getTime() - campaign.reminderMinutes * 60_000) || now > new Date(auction.startDate.getTime() + 5 * 60_000)) return { reason: 'Auction reminder window changed or expired' };
    if (row.recipientUserId && !await client.auctionRegistration.findUnique({ where: { auctionId_userId: { auctionId: auction.id, userId: row.recipientUserId } } }).then(value => value?.status === 'APPROVED')) return { reason: 'Registration no longer approved' };
  }
  if (row.kind === 'LOT_NEXT') {
    const untilStart = auction.startDate.getTime() - now.getTime();
    const firstLotWindow = !auction.auctioneerStartedAt && untilStart <= 5 * 60_000 && untilStart >= -5 * 60_000;
    if (!campaign.lotReminders || !row.recipientUserId || (!(auction.status === 'LIVE' && auction.auctioneerStartedAt) && !firstLotWindow)) return { reason: 'Lot reminders disabled' };
    const watch = await client.lotWatch.findUnique({ where: { userId_lotId: { userId: row.recipientUserId, lotId: row.lotId } } });
    const lot = await client.lot.findUnique({ where: { id: row.lotId } });
    if (!watch || !lot || lot.auctionId !== auction.id || !lot.isReady || lot.status !== 'ACTIVE') return { reason: 'Lot is no longer watched or available' };
    const lots = await client.lot.findMany({ where: { auctionId: auction.id, isReady: true, status: 'ACTIVE' }, orderBy: [{ position: 'asc' }, { lotNumber: 'asc' }] });
    const { current, next } = nextMarketingLot(auction, lots, now);
    if (lot.id !== current?.id && lot.id !== next?.id) return { reason: 'Live queue changed' };
    if (lot.id === current?.id && (!lot.endTime || lot.endTime <= now)) return { reason: 'Lot bidding has closed' };
    return { lot, live: lot.id === current?.id };
  }
  return {};
}

export async function processMarketing({ client = prisma, houseId, now = new Date(), limit = 25, send = sendTransactionalEmail } = {}) {
  // A worker may have died after the provider accepted a message. Never resend it blindly.
  await client.marketingMessage.updateMany({ where: { ...(houseId ? { auctionHouseId: houseId } : {}), status: 'PROCESSING', claimedAt: { lt: new Date(now.getTime() - 20 * 60_000) } }, data: { status: 'UNKNOWN', error: 'Delivery could not be confirmed. Check SMTP2GO activity before sending again.' } });
  const campaigns = await client.marketingCampaign.findMany({ where: { ...(houseId ? { auctionHouseId: houseId } : {}), enabled: true, auction: { status: { in: ['UPCOMING', 'LIVE'] } } }, include: { auction: true, auctionHouse: true } });
  for (const campaign of campaigns) await queueCampaignReminders(campaign, { client, now });
  const batchSize = Math.max(1, Math.min(limit, 50));
  const scope = { ...(houseId ? { auctionHouseId: houseId } : {}), status: 'QUEUED' };
  // Live reminders take precedence over a large imported invitation list.
  const urgent = await client.marketingMessage.findMany({ where: { ...scope, kind: { in: ['LOT_NEXT', 'AUCTION_START'] } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: batchSize, select: { id: true } });
  const regular = urgent.length < batchSize ? await client.marketingMessage.findMany({ where: { ...scope, kind: { in: ['INVITATION', 'UPDATE'] } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: batchSize - urgent.length, select: { id: true } }) : [];
  const pending = [...urgent, ...regular];
  const result = { accepted: 0, failed: 0, unknown: 0, cancelled: 0 };
  async function deliver(id) {
    const claimed = await client.marketingMessage.updateMany({ where: { id, status: 'QUEUED' }, data: { status: 'PROCESSING', claimedAt: now } });
    if (!claimed.count) return;
    let accepted = false;
    try {
      const row = await client.marketingMessage.findUnique({ where: { id }, include: { contact: true, campaign: { include: { auction: true, auctionHouse: true } } } });
      if (!row) return;
      const eligibility = await messageEligibility(row, { client, now: new Date() });
      if (eligibility.reason) {
        await client.marketingMessage.update({ where: { id }, data: { status: 'CANCELLED', error: eligibility.reason } }); result.cancelled++; return;
      }
      const response = await send(marketingEmail({ ...row, lot: eligibility.lot }, { live: eligibility.live }));
      accepted = true;
      await client.marketingMessage.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), providerId: response.data?.email_id || null, error: null } });
      result.accepted++;
    } catch (err) {
      const uncertain = accepted || err.deliveryUncertain || !err.status;
      const status = uncertain ? 'UNKNOWN' : 'FAILED';
      await client.marketingMessage.updateMany({ where: { id, status: 'PROCESSING' }, data: { status, error: uncertain ? 'Delivery could not be confirmed. Check SMTP2GO activity before sending again.' : 'Email rejected. Check SMTP2GO configuration and recipient, then retry.' } });
      result[uncertain ? 'unknown' : 'failed']++;
    }
  }
  // Bounded concurrency keeps SMTP requests inside a serverless invocation budget.
  for (let i = 0; i < pending.length; i += 5) await Promise.all(pending.slice(i, i + 5).map(row => deliver(row.id)));
  return result;
}
