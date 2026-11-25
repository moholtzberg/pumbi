import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import prisma from '$lib/prisma.js';
import { contactData, parseContactCsv } from '$lib/server/marketingContacts.js';
import { requireMarketingHouse, queueInvitations, processMarketing } from '$lib/server/marketing.js';
import { emailConfigured } from '$lib/server/smtp2go.js';

export const config = { maxDuration: 120 };
const reply = data => json(data, { headers: { 'cache-control': 'private, no-store' } });
function sendingConfigured() {
  if (!emailConfigured() || !env.AUTH_SECRET) throw error(503, 'Set SMTP2GO_API_KEY and AUTH_SECRET before sending auction emails');
}
function text(value, max, field) {
  if (value != null && typeof value !== 'string') throw error(400, `${field} must be text`);
  const result = (value || '').trim();
  if (result.length > max) throw error(400, `${field} must be ${max} characters or fewer`);
  return result || null;
}
async function campaignFor(houseId, auctionId, client = prisma) {
  if (typeof auctionId !== 'string') throw error(400, 'Choose an auction');
  const campaign = await client.marketingCampaign.findFirst({ where: { auctionHouseId: houseId, auctionId }, include: { auction: { select: { status: true } } } });
  if (!campaign) throw error(400, 'Save email settings for this auction first');
  if (['ENDED', 'CANCELLED'].includes(campaign.auction.status)) throw error(400, 'Choose an upcoming or live auction');
  if (!campaign.enabled) throw error(400, 'Enable this auction’s marketing emails first');
  return campaign;
}
async function activeContacts(houseId, ids, client = prisma) {
  if (ids != null && (!Array.isArray(ids) || !ids.length || ids.length > 5000 || ids.some(id => typeof id !== 'string'))) throw error(400, 'Select 1–5,000 contacts');
  const suppressed = await client.marketingSuppression.findMany({ where: { auctionHouseId: houseId }, select: { email: true } });
  const contacts = await client.marketingContact.findMany({ where: { auctionHouseId: houseId, subscribed: true, ...(ids ? { id: { in: ids } } : {}), email: { notIn: suppressed.map(row => row.email) } }, take: 5001 });
  if (contacts.length > 5000) throw error(400, 'Select up to 5,000 contacts per invitation');
  return contacts;
}

export async function GET({ params, locals, url }) {
  const house = await requireMarketingHouse(locals, params.id);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 160);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const where = { auctionHouseId: house.id, ...(q ? { OR: ['email', 'name', 'phone', 'tags'].map(key => ({ [key]: { contains: q, mode: 'insensitive' } })) } : {}) };
  const auctionId = url.searchParams.get('auctionId');
  const [contacts, count, totalContacts, subscribed, optedOut, auctions, campaign, history, statuses] = await Promise.all([
    prisma.marketingContact.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (Math.min(page, 100000) - 1) * 30, take: 30 }),
    prisma.marketingContact.count({ where }),
    prisma.marketingContact.count({ where: { auctionHouseId: house.id } }),
    prisma.marketingContact.count({ where: { auctionHouseId: house.id, subscribed: true } }),
    prisma.marketingSuppression.count({ where: { auctionHouseId: house.id } }),
    prisma.auction.findMany({ where: { auctionHouseId: house.id, status: { in: ['UPCOMING', 'LIVE'] } }, orderBy: { startDate: 'asc' }, select: { id: true, title: true, startDate: true, status: true } }),
    auctionId ? prisma.marketingCampaign.findFirst({ where: { auctionHouseId: house.id, auctionId }, include: { _count: { select: { enrollments: true } } } }) : null,
    prisma.marketingMessage.findMany({ where: { auctionHouseId: house.id, ...(auctionId ? { campaign: { auctionId } } : {}) }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, email: true, kind: true, status: true, subject: true, error: true, createdAt: true, sentAt: true } }),
    prisma.marketingMessage.groupBy({ by: ['status'], where: { auctionHouseId: house.id, ...(auctionId ? { campaign: { auctionId } } : {}) }, _count: { _all: true } })
  ]);
  return reply({ house, contacts, count, page, totalContacts, subscribed, optedOut, auctions, campaign, history, statuses: Object.fromEntries(statuses.map(row => [row.status, row._count._all])), emailConfigured: emailConfigured() });
}

export async function POST({ params, locals, request, url }) {
  const house = await requireMarketingHouse(locals, params.id);
  const body = await request.json().catch(() => { throw error(400, 'A JSON request body is required'); });
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'A JSON object is required');
  switch (body.action) {
    case 'save_contacts': {
      if (body.consentConfirmed !== true) throw error(400, 'Confirm that these contacts agreed to auction invitation emails');
      const records = typeof body.csv === 'string' ? parseContactCsv(body.csv) : [contactData(body.contact || {})];
      const campaign = body.auctionId ? await campaignFor(house.id, body.auctionId) : null;
      if (campaign) sendingConfigured();
      const result = await prisma.$transaction(async tx => {
        const suppressions = await tx.marketingSuppression.findMany({ where: { auctionHouseId: house.id, email: { in: records.map(row => row.email) } }, select: { email: true } });
        const suppressed = new Set(suppressions.map(row => row.email));
        const saved = [];
        for (const record of records) {
          const update = Object.fromEntries(Object.entries(record).filter(([key, value]) => key !== 'email' && value !== null));
          saved.push(await tx.marketingContact.upsert({ where: { auctionHouseId_email: { auctionHouseId: house.id, email: record.email } }, create: { ...record, auctionHouseId: house.id, source: body.csv ? 'CSV' : 'MANUAL', subscribed: !suppressed.has(record.email) }, update }));
        }
        const queued = campaign ? await queueInvitations(campaign, saved.filter(row => !suppressed.has(row.email)), tx) : { queued: 0 };
        return { saved: saved.length, skippedOptOuts: saved.filter(row => suppressed.has(row.email)).length, ...queued };
      }, { timeout: 60_000 });
      return reply(result);
    }
    case 'edit_contact': {
      if (typeof body.contactId !== 'string' || !body.contactId) throw error(400, 'Select a contact');
      const contact = await prisma.marketingContact.findFirst({ where: { id: body.contactId, auctionHouseId: house.id } });
      if (!contact) throw error(404, 'Contact not found');
      const data = contactData({ ...body.contact, email: contact.email });
      if (typeof body.subscribed !== 'boolean') throw error(400, 'Choose the contact subscription status');
      if (body.subscribed && await prisma.marketingSuppression.findUnique({ where: { auctionHouseId_email: { auctionHouseId: house.id, email: contact.email } } })) throw error(400, 'This contact unsubscribed. Reimporting or editing cannot override their preference.');
      const updated = await prisma.marketingContact.update({ where: { id: contact.id }, data: { ...data, subscribed: body.subscribed } });
      return reply({ contact: updated });
    }
    case 'delete_contact': {
      if (typeof body.contactId !== 'string') throw error(400, 'Select a contact');
      await prisma.marketingContact.deleteMany({ where: { id: body.contactId, auctionHouseId: house.id } });
      return reply({ deleted: true });
    }
    case 'save_campaign': {
      if (typeof body.auctionId !== 'string') throw error(400, 'Choose an auction');
      const auction = await prisma.auction.findFirst({ where: { id: body.auctionId, auctionHouseId: house.id, status: { in: ['UPCOMING', 'LIVE'] } }, select: { id: true } });
      if (!auction) throw error(404, 'Upcoming or live auction not found');
      const reminderMinutes = Number(body.reminderMinutes);
      if (!Number.isInteger(reminderMinutes) || reminderMinutes < 5 || reminderMinutes > 1440) throw error(400, 'Auction reminders must be 5–1,440 minutes before start');
      if (['enabled', 'auctionReminders', 'lotReminders'].some(key => typeof body[key] !== 'boolean')) throw error(400, 'Email settings must be on or off');
      const origin = new URL(env.APP_URL || url.origin);
      if (!['https:', 'http:'].includes(origin.protocol)) throw error(400, 'APP_URL must be an HTTP or HTTPS site URL');
      const data = { enabled: body.enabled, auctionReminders: body.auctionReminders, lotReminders: body.lotReminders, reminderMinutes, subject: text(body.subject, 180, 'Subject'), message: text(body.message, 8000, 'Message'), siteUrl: origin.origin };
      const campaign = await prisma.marketingCampaign.upsert({ where: { auctionId: auction.id }, create: { ...data, auctionId: auction.id, auctionHouseId: house.id }, update: data });
      return reply({ campaign });
    }
    case 'invite': {
      sendingConfigured();
      const campaign = await campaignFor(house.id, body.auctionId);
      const contacts = await activeContacts(house.id, body.contactIds);
      return reply(await prisma.$transaction(tx => queueInvitations(campaign, contacts, tx)));
    }
    case 'update': {
      sendingConfigured();
      const campaign = await campaignFor(house.id, body.auctionId);
      const subject = text(body.subject, 180, 'Subject'), message = text(body.message, 8000, 'Message');
      if (!subject || !message) throw error(400, 'Enter an update subject and message');
      if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) throw error(400, 'A valid update request ID is required');
      const enrollments = await prisma.marketingEnrollment.findMany({ where: { campaignId: campaign.id, contact: { subscribed: true } }, include: { contact: true } });
      if (!enrollments.length) throw error(400, 'Invite contacts to this auction before sending an update');
      const result = await prisma.marketingMessage.createMany({ data: enrollments.map(({ contact }) => ({ auctionHouseId: house.id, campaignId: campaign.id, contactId: contact.id, email: contact.email, eventKey: `${campaign.auctionId}:update:${body.requestId}`, kind: 'UPDATE', subject, message })), skipDuplicates: true });
      return reply({ queued: result.count });
    }
    case 'retry': {
      sendingConfigured();
      if (typeof body.messageId !== 'string') throw error(400, 'Choose an email to retry');
      const result = await prisma.marketingMessage.updateMany({ where: { id: body.messageId, auctionHouseId: house.id, status: 'FAILED' }, data: { status: 'QUEUED', claimedAt: null, error: null } });
      return reply({ queued: result.count });
    }
    case 'process':
      sendingConfigured();
      return reply(await processMarketing({ houseId: house.id, limit: 10 }));
    default: throw error(400, 'Unknown marketing action');
  }
}
