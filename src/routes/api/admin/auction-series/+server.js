import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { adminError, requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import { getZonedDateTimeUtc } from '$lib/server/auctionSchedule.js';

export const _PLATFORM_AUCTION_HOUSE_ID = 'pumbi';

function integer(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw error(400, `${label} must be between ${min} and ${max}`);
  }
  return number;
}

export function _seriesData(data) {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) throw error(400, 'Name is required');
  if (data.auctionType !== 'PUBLIC') throw error(400, 'Recurring platform series must be PUBLIC');
  if (!/^\d{2}:\d{2}$/.test(data.recurrenceLocalTime || '')) {
    throw error(400, 'Local time must use HH:MM format');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: data.timezone }).format();
  } catch {
    throw error(400, 'Invalid timezone');
  }

  let nextRunAt = null;
  if (data.nextRunAt) {
    try {
      nextRunAt = getZonedDateTimeUtc({
        localDateTime: data.nextRunAt,
        timezone: data.timezone
      });
    } catch {
      throw error(400, 'Invalid next run date for the selected timezone');
    }
  }

  return {
    name,
    auctionHouseId: _PLATFORM_AUCTION_HOUSE_ID,
    auctionType: data.auctionType,
    timezone: data.timezone,
    recurrenceDayOfMonth: integer(data.recurrenceDayOfMonth, 'Day of month', 1, 31),
    recurrenceLocalTime: data.recurrenceLocalTime,
    nextRunAt,
    submissionCutoffOffsetDays: integer(data.submissionCutoffOffsetDays, 'Submission cutoff', 0, 365),
    auctionStartOffsetMinutes: integer(data.auctionStartOffsetMinutes, 'Start offset', -525600, 525600),
    auctionDurationMinutes: integer(data.auctionDurationMinutes, 'Duration', 1, 525600),
    registrationOpenOffsetDays: integer(data.registrationOpenOffsetDays, 'Registration open offset', 0, 365),
    registrationCloseOffsetMinutes: integer(data.registrationCloseOffsetMinutes, 'Registration close offset', -525600, 525600),
    isActive: data.isActive !== false
  };
}

export async function GET({ locals }) {
  await requirePlatformAdmin(locals);
  const series = await prisma.auctionSeries.findMany({
    orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    include: {
      auctionHouse: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
      _count: { select: { auctions: true, lotSubmissions: true } }
    }
  });
  return json({ series });
}

export async function POST({ request, locals }) {
  const admin = await requirePlatformAdmin(locals);
  try {
    const data = _seriesData(await request.json());
    const created = await prisma.auctionSeries.create({
      data: { ...data, createdById: admin.id },
      include: { auctionHouse: { select: { id: true, name: true } } }
    });
    return json(created, { status: 201 });
  } catch (err) {
    adminError(err, 'Failed to create auction series');
  }
}
