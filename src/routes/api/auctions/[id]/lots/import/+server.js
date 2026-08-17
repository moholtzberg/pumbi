import { json, error } from '@sveltejs/kit';
import XLSX from 'xlsx';
import prisma from '$lib/prisma.js';
import { Lot } from '$lib/models/Lot.js';
import {
  requireAuthenticatedUser,
  requireAuctionAccess
} from '$lib/server/authorization.js';

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[,;|]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function parseImageList(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[,;|]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function normalizeStatus(value) {
  if (!value) return 'ACTIVE';
  const normalized = String(value).trim().toUpperCase();
  return ['ACTIVE', 'SOLD', 'UNSOLD', 'WITHDRAWN'].includes(normalized) ? normalized : 'ACTIVE';
}

async function parseWorkbook(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function collectColumns(rows) {
  const columns = new Set();
  rows.slice(0, 100).forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      const col = (key || '').toString().trim();
      if (col) columns.add(col);
    });
  });
  return Array.from(columns);
}

async function ensureAuctionAccess(auctionId, user) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { auctionHouse: true }
  });

  requireAuctionAccess(user, auction);
  return auction;
}

function requireFile(formData) {
  const file = formData.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw error(400, 'Import file is required');
  }
  return file;
}

function requireMapping(mapping, columns) {
  if (!mapping || typeof mapping !== 'object') {
    throw error(400, 'Invalid mapping payload');
  }

  const required = ['lotNumber', 'title'];
  const missing = required.filter((field) => !mapping[field]);
  if (missing.length) {
    throw error(400, `Missing mappings: ${missing.join(', ')}`);
  }

  const unknownColumns = Object.values(mapping).filter(
    (col) => col && col !== '__skip__' && !columns.includes(col)
  );

  if (unknownColumns.length) {
    throw error(400, `Unknown columns in mapping: ${unknownColumns.join(', ')}`);
  }
}

function buildLotPayload(row, mapping, auctionId, fallbackPosition) {
  const getVal = (key) => {
    if (!key || key === '__skip__') return null;
    return row[key];
  };

  const lotNumberRaw = getVal(mapping.lotNumber);
  const lotNumber = parseInt(lotNumberRaw, 10);
  if (!Number.isFinite(lotNumber)) {
    throw new Error('Missing or invalid lot number');
  }

  const titleRaw = getVal(mapping.title);
  const title = titleRaw && String(titleRaw).trim() ? String(titleRaw).trim() : `Lot ${lotNumber}`;

  const payload = {
    auctionId,
    lotNumber,
    position: mapping.position ? parseNumber(getVal(mapping.position), fallbackPosition) : fallbackPosition,
    title,
    hebrewTitle: getVal(mapping.hebrewTitle) || null,
    description: getVal(mapping.description) || null,
    hebrewDescription: getVal(mapping.hebrewDescription) || null,
    category: getVal(mapping.category) || null,
    tags: parseTags(getVal(mapping.tags)),
    startingBid: parseNumber(getVal(mapping.startingBid), 0),
    currentBid: parseNumber(
      getVal(mapping.currentBid),
      parseNumber(getVal(mapping.startingBid), 0)
    ),
    bidIncrement: parseNumber(getVal(mapping.bidIncrement), 100),
    endTime: parseDate(getVal(mapping.endTime)),
    status: normalizeStatus(getVal(mapping.status)),
    // imageUrl / imageUrls are not Prisma fields; keep only array for potential future use
    imageUrls: parseImageList(getVal(mapping.imageUrls))
  };

  return payload;
}

function toPrismaData(payload, { includeAuctionId = true } = {}) {
  const {
    auctionId,
    imageUrls, // currently unused in Prisma schema
    imageUrl, // not in schema
    tags,
    metaFields,
    ...rest
  } = payload;

  const data = {
    ...rest,
    // Prisma expects string for tags/metaFields
    tags: tags && tags.length ? JSON.stringify(tags) : null,
    metaFields: metaFields && typeof metaFields === 'object' ? JSON.stringify(metaFields) : metaFields || null
  };

  if (includeAuctionId) {
    data.auctionId = auctionId;
  }

  return data;
}

export async function POST({ params, request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);
    await ensureAuctionAccess(params.id, user);

    const formData = await request.formData();
    const action = (formData.get('action') || 'preview').toString();
    const file = requireFile(formData);

    const rows = await parseWorkbook(file);
    if (!rows || rows.length === 0) {
      return json({ columns: [], sampleRows: [], created: 0, updated: 0, errors: [] });
    }

    const columns = collectColumns(rows);

    if (action === 'preview') {
      return json({
        columns,
        sampleRows: rows.slice(0, 20)
      });
    }

    // Import mode
    let mapping;
    try {
      mapping = JSON.parse(formData.get('mapping') || '{}');
    } catch (err) {
      throw error(400, 'Invalid mapping JSON');
    }

    requireMapping(mapping, columns);

    const existingLots = await prisma.lot.findMany({
      where: { auctionId: params.id }
    });
    const existingByLotNumber = new Map(
      existingLots.map((lot) => [String(lot.lotNumber), lot])
    );
    const basePosition =
      existingLots.length > 0
        ? Math.max(...existingLots.map((l) => l.position || 0))
        : 0;

    let created = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const payload = buildLotPayload(
          row,
          mapping,
          params.id,
          basePosition + created + 1
        );

        const existing = existingByLotNumber.get(String(payload.lotNumber));

        if (existing) {
          await prisma.lot.update({
            where: { id: existing.id },
            data: toPrismaData(payload, { includeAuctionId: false })
          });
          updated += 1;
        } else {
          await prisma.lot.create({
            data: toPrismaData(payload, { includeAuctionId: true })
          });
          created += 1;
        }
      } catch (err) {
        errors.push({
          row: i + 2, // account for header row
          message: err.message || 'Unknown error'
        });
      }
    }

    return json({ created, updated, errors });
  } catch (err) {
    if (err?.status) {
      throw err;
    }
    console.error('Error importing lots:', err);
    throw error(500, err.message || 'Failed to import lots');
  }
}


