import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function lotData(row, auctionId, position) {
  const lotNumber = Number.parseInt(row.lotNumber, 10);
  const title = String(row.title || '').trim();
  if (!Number.isInteger(lotNumber) || lotNumber < 1) throw new Error('Lot number must be a positive whole number');
  if (!title) throw new Error('Title is required');
  const start = positiveNumber(row.startingBid, 0);
  const increment = Number(row.bidIncrement);
  if (!Number.isFinite(increment) || increment <= 0) throw new Error('Bid increment must be greater than zero');
  const endTime = row.endTime ? new Date(row.endTime) : null;
  if (endTime && Number.isNaN(endTime.getTime())) throw new Error('End time is invalid');
  return {
    auctionId,
    lotNumber,
    position: Number.isInteger(Number(row.position)) ? Number(row.position) : position,
    title,
    description: row.description ? String(row.description) : null,
    category: row.category ? String(row.category) : null,
    startingBid: start,
    currentBid: positiveNumber(row.currentBid, start),
    bidIncrement: increment,
    endTime,
    status: ['ACTIVE', 'SOLD', 'UNSOLD', 'WITHDRAWN'].includes(String(row.status || 'ACTIVE').toUpperCase()) ? String(row.status || 'ACTIVE').toUpperCase() : 'ACTIVE',
    initialTimerSeconds: row.initialTimerSeconds ? Number(row.initialTimerSeconds) : null,
    bidExtensionSeconds: row.bidExtensionSeconds ? Number(row.bidExtensionSeconds) : null,
    isReady: row.isReady === undefined ? true : Boolean(row.isReady)
  };
}

export async function POST({ params, request, locals }) {
  const user = await requireAuthenticatedUser(locals);
  const auction = await prisma.auction.findUnique({ where: { id: params.id } });
  requireAuctionAccess(user, auction);
  await requireAuctionHousePermission(user, auction.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_CATALOG);

  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length || rows.length > 1000) throw error(400, 'Provide between 1 and 1,000 rows');

  const existing = await prisma.lot.findMany({ where: { auctionId: auction.id }, select: { id: true, lotNumber: true, position: true } });
  const byNumber = new Map(existing.map((lot) => [lot.lotNumber, lot]));
  let created = 0;
  let updated = 0;
  const errors = [];
  for (let index = 0; index < rows.length; index += 1) {
    try {
      const data = lotData(rows[index] || {}, auction.id, existing.length + index + 1);
      const match = byNumber.get(data.lotNumber);
      if (match) {
        const { auctionId: ignored, lotNumber: ignoredNumber, ...updates } = data;
        await prisma.lot.update({ where: { id: match.id }, data: updates });
        updated += 1;
      } else {
        await prisma.lot.create({ data });
        created += 1;
      }
    } catch (err) {
      errors.push({ row: index + 1, message: err.message || 'Invalid row' });
    }
  }
  return json({ created, updated, errors });
}
