import { error } from '@sveltejs/kit';
import { createRequire } from 'node:module';
import prisma from '$lib/prisma.js';
import { adminModels, adminModelMap } from '$lib/server/adminCatalog.js';
import { serializeAdminValue } from '$lib/utils/adminSchema.js';
import { normalizeHouseSlug, houseSlugProblem } from '$lib/utils/houseSlugs.js';
import { hashPassword } from '$lib/utils/password.js';

const { Prisma } = createRequire(import.meta.url)('@prisma/client');
export { adminModels };
export function modelFor(key) {
  const model = adminModelMap.get(key);
  if (!model) throw error(404, 'Unknown data collection');
  return model;
}
const publicSelect = model => Object.fromEntries(model.fields.filter(field => !field.secret).map(field => [field.name, true]));
const safeRecord = (model, row) => serializeAdminValue(Object.fromEntries(model.fields.filter(field => !field.secret).map(field => [field.name, row[field.name]])));

export async function parseAdminData(model, input, { creating = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw error(400, 'Record data must be a JSON object');
  const data = {};
  for (const [key, value] of Object.entries(input)) {
    const field = model.fields.find(field => field.name === key);
    if (!field) throw error(400, `Unknown field: ${key}`);
    if (!creating && field.id) throw error(400, 'Record IDs cannot be changed');
    if (field.secret && value === '') continue;
    if (value === null) {
      if (field.type === 'Json') data[key] = field.nullable ? Prisma.DbNull : Prisma.JsonNull;
      else if (field.nullable) data[key] = null;
      else throw error(400, `${field.label} cannot be null`);
      continue;
    }
    if (field.list) {
      if (!Array.isArray(value)) throw error(400, `${field.label} must be an array`);
      data[key] = value;
      continue;
    }
    if (field.values) {
      if (!field.values.includes(value)) throw error(400, `${field.label} must be one of: ${field.values.join(', ')}`);
      data[key] = value;
    } else switch (field.type) {
      case 'String':
        if (typeof value !== 'string') throw error(400, `${field.label} must be text`);
        if ((field.required || field.id) && !value.trim()) throw error(400, `${field.label} cannot be empty`);
        if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw error(400, 'Enter a valid email address');
        data[key] = value;
        break;
      case 'Boolean':
        if (typeof value !== 'boolean') throw error(400, `${field.label} must be true or false`);
        data[key] = value;
        break;
      case 'Int': case 'Float':
        if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || (field.type === 'Int' && (!Number.isSafeInteger(Number(value)) || Number(value) < -2147483648 || Number(value) > 2147483647))) throw error(400, `${field.label} must be a valid ${field.type === 'Int' ? '32-bit integer' : 'number'}`);
        data[key] = Number(value);
        break;
      case 'Decimal':
        if (!['string', 'number'].includes(typeof value) || !/^-?\d+(?:\.\d+)?$/.test(String(value))) throw error(400, `${field.label} must be a decimal number`);
        data[key] = String(value);
        break;
      case 'BigInt':
        if (typeof value === 'number' && !Number.isSafeInteger(value)) throw error(400, `${field.label} must be supplied as a quoted whole number to preserve precision`);
        if (!/^-?\d+$/.test(String(value))) throw error(400, `${field.label} must be a whole number`);
        data[key] = BigInt(value);
        if (data[key] < -9223372036854775808n || data[key] > 9223372036854775807n) throw error(400, `${field.label} is outside the supported range`);
        break;
      case 'DateTime':
        if (typeof value !== 'string' || !value || Number.isNaN(new Date(value).getTime())) throw error(400, `${field.label} must be a valid date/time`);
        data[key] = new Date(value);
        break;
      case 'Json':
        data[key] = value;
        if (data[key] === null) data[key] = Prisma.JsonNull;
        break;
      case 'Bytes':
        if (typeof value !== 'string') throw error(400, `${field.label} must be base64 text`);
        data[key] = Buffer.from(value, 'base64');
        break;
      default: throw error(400, `Unsupported field type: ${field.type}`);
    }
  }
  if (creating) {
    const missing = model.fields.filter(field => field.required && data[field.name] === undefined);
    if (missing.length) throw error(400, `Required fields: ${missing.map(field => field.label).join(', ')}`);
  }
  if (model.name === 'AuctionHouse' && Object.hasOwn(data, 'slug')) {
    data.slug = normalizeHouseSlug(data.slug);
    const message = houseSlugProblem(data.slug);
    if (message) throw error(400, message);
  }
  if (model.name === 'User' && Object.hasOwn(data, 'password')) {
    if (typeof data.password === 'string') {
      if (data.password.length < 8 || data.password.length > 32) throw error(400, 'New passwords must contain 8–32 characters');
      data.password = await hashPassword(data.password);
    }
    data.resetPasswordToken = null;
    data.resetPasswordExpires = null;
  }
  if (data.startDate && data.endDate && data.endDate <= data.startDate) throw error(400, 'End date must be after start date');
  return data;
}

export function dataError(err) {
  if (err.status) throw err;
  if (err.code === 'P2002') throw error(409, 'A record with those unique values already exists');
  if (err.code === 'P2003' || err.code === 'P2014') throw error(409, 'A related record is missing or still refers to this record. Review the related records first.');
  if (err.code === 'P2025') throw error(404, 'Record not found');
  if (err.name === 'PrismaClientValidationError' || ['P2000', 'P2006', 'P2007', 'P2011', 'P2012', 'P2013', 'P2020'].includes(err.code)) throw error(400, 'These values do not match the record schema. Check field types, required values, and relationships.');
  console.error('Admin data operation failed', { code: err.code, name: err.name });
  throw error(500, 'Unable to complete this data operation');
}

export async function listRecords(key, url) {
  const model = modelFor(key);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
  const page = Math.max(1, Math.min(1_000_000, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1));
  const pageSize = 30;
  const where = {};
  const referenceField = url.searchParams.get('referenceField');
  if (referenceField) {
    const field = model.fields.find(field => field.name === referenceField && field.reference);
    const referenceId = url.searchParams.get('referenceId');
    if (!field || !referenceId) throw error(400, 'Invalid related-record filter');
    where[field.name] = referenceId;
  }
  if (q) where.OR = model.fields.filter(field => field.type === 'String' && !field.secret).map(field => ({ [field.name]: { contains: q, mode: 'insensitive' } }));
  const filter = url.searchParams.get('filter');
  if (filter) {
    const field = model.fields.find(field => field.name === filter && !field.secret && (field.values || field.type === 'Boolean'));
    const value = url.searchParams.get('value');
    if (!field || (field.values && !field.values.includes(value)) || (field.type === 'Boolean' && !['true', 'false'].includes(value))) throw error(400, 'Invalid field filter');
    where[field.name] = field.type === 'Boolean' ? value === 'true' : value;
  }
  const sort = url.searchParams.get('sort') || (model.fields.some(field => field.name === 'createdAt') ? 'createdAt' : 'id');
  if (!model.fields.some(field => field.name === sort && !field.secret && !field.list && field.type !== 'Json')) throw error(400, 'Invalid sort field');
  const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const [rows, total] = await Promise.all([
    prisma[model.key].findMany({ where, select: publicSelect(model), orderBy: [{ [sort]: order }, ...(sort === 'id' ? [] : [{ id: 'asc' }])], take: pageSize, skip: (page - 1) * pageSize }),
    prisma[model.key].count({ where })
  ]);
  return { model, rows: rows.map(row => safeRecord(model, row)), total, page, pageSize, q, filter: filter || '', value: url.searchParams.get('value') || '', sort, order, referenceField: referenceField || '', referenceId: url.searchParams.get('referenceId') || '' };
}

export async function relatedRecords(model, row, client = prisma) {
  return Promise.all(model.dependents.map(async relation => {
    const where = Object.fromEntries(relation.fields.map((field, index) => [field, row[relation.references[index]]]));
    const count = await client[relation.model].count({ where });
    return { ...relation, count, parentValues: relation.references.map(field => row[field]) };
  }));
}

export async function readRecord(key, id) {
  const model = modelFor(key);
  const row = await prisma[model.key].findUnique({ where: { id } });
  if (!row) throw error(404, 'Record not found');
  return { record: safeRecord(model, row), secretsSet: Object.fromEntries(model.fields.filter(field => field.secret).map(field => [field.name, row[field.name] != null])), related: await relatedRecords(model, row) };
}

export async function mutateRecord({ key, id, input, revision, actor, deleting = false, confirmation }) {
  const model = modelFor(key);
  const creating = !id;
  const data = deleting ? {} : await parseAdminData(model, input, { creating });
  return prisma.$transaction(async tx => {
    if (model.name === 'User') {
      await tx.$queryRaw`SELECT id FROM users WHERE role = 'PLATFORM_ADMIN' ORDER BY id FOR UPDATE`;
    }
    const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true } });
    if (currentActor?.role !== 'PLATFORM_ADMIN') throw error(403, 'Platform administrator access required');
    let current;
    if (!creating) {
      // The table identifier comes only from the server's schema catalog, never
      // from request input. Lock before reading the revision to prevent two
      // simultaneous editors from overwriting each other after the same check.
      const table = Prisma.raw(`"${model.table.replaceAll('"', '""')}"`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${table} WHERE "id" = ${id} FOR UPDATE`);
      current = await tx[model.key].findUnique({ where: { id } });
      if (!current) throw error(404, 'Record not found');
      if (current.updatedAt && (!revision || new Date(revision).getTime() !== current.updatedAt.getTime())) throw error(409, 'This record changed after you opened it. Reload before saving or deleting.');
      if (model.name === 'User' && id === actor.id && (deleting || (data.role && data.role !== 'PLATFORM_ADMIN'))) throw error(409, 'Use another administrator account to delete your account or change your own admin role.');
      if (model.name === 'User' && current.role === 'PLATFORM_ADMIN' && (deleting || (data.role && data.role !== 'PLATFORM_ADMIN')) && await tx.user.count({ where: { role: 'PLATFORM_ADMIN' } }) <= 1) throw error(409, 'At least one platform administrator must remain.');
    }
    if (model.name === 'AuctionHouse' && data.slug) {
      const duplicate = await tx.auctionHouse.findFirst({ where: { slug: { equals: data.slug, mode: 'insensitive' }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
      if (duplicate) throw error(409, 'An auction house with this slug already exists');
    }
    if (model.name === 'Auction') {
      const start = data.startDate || current?.startDate;
      const end = data.endDate || current?.endDate;
      if (start && end && end <= start) throw error(400, 'End date must be after start date');
    }
    if (deleting) {
      if (confirmation !== id) throw error(400, 'Type the exact record ID to confirm deletion');
      await tx[model.key].delete({ where: { id } });
      return { deleted: true, id };
    }
    const row = creating ? await tx[model.key].create({ data, select: publicSelect(model) }) : await tx[model.key].update({ where: { id }, data, select: publicSelect(model) });
    return { record: safeRecord(model, row) };
  });
}
