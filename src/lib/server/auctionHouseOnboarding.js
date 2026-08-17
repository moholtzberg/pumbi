import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_ROLES,
  isPlatformAdmin,
  requireAuthenticatedUser,
  requireAuctionHouseRole
} from '$lib/server/authorization.js';
import { getPresignedUrl } from '$lib/services/cloudStorage.js';

export const ALL_HOUSE_ROLES = Object.freeze(Object.values(HOUSE_ROLES));
export const ONBOARDING_EDIT_ROLES = Object.freeze([HOUSE_ROLES.OWNER, HOUSE_ROLES.ADMIN]);
export const ALLOWED_UPLOAD_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png'
]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const onboardingSelect = {
  id: true,
  name: true,
  legalName: true,
  businessType: true,
  registrationNumber: true,
  website: true,
  contactFirstName: true,
  contactLastName: true,
  contactEmail: true,
  contactPhone: true,
  country: true,
  onboardingStatus: true,
  onboardingStep: true,
  onboardingSubmittedAt: true,
  onboardingReviewedAt: true,
  onboardingApprovedAt: true,
  onboardingRejectedAt: true,
  onboardingRejectionReason: true,
  termsVersion: true,
  termsAcceptedAt: true,
  createdAt: true,
  updatedAt: true,
  locations: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  documents: {
    select: {
      id: true,
      type: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      licenseNumber: true,
      jurisdiction: true,
      expiresAt: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewNotes: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' }
  },
  assets: {
    select: {
      id: true,
      type: true,
      visibility: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' }
  }
};

export async function requireHouseMember(locals, auctionHouseId) {
  const user = await requireAuthenticatedUser(locals);
  const membership = await requireAuctionHouseRole(user, auctionHouseId, ALL_HOUSE_ROLES);
  return { user, membership };
}

export async function requireHouseEditor(locals, auctionHouseId) {
  const user = await requireAuthenticatedUser(locals);
  if (isPlatformAdmin(user)) {
    throw error(403, 'Platform administrators must use the onboarding review API');
  }
  const membership = await requireAuctionHouseRole(user, auctionHouseId, ONBOARDING_EDIT_ROLES);
  return { user, membership };
}

export function requireEditableStatus(status) {
  if (!['DRAFT', 'REJECTED'].includes(status)) {
    throw error(409, 'Onboarding can only be edited while draft or rejected');
  }
}

export function requiredString(value, label, maxLength = 500) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw error(400, `${label} is required`);
  if (result.length > maxLength) throw error(400, `${label} is too long`);
  return result;
}

export function optionalString(value, label, maxLength = 500) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw error(400, `${label} must be a string`);
  const result = value.trim();
  if (result.length > maxLength) throw error(400, `${label} is too long`);
  return result || null;
}

export function parseDate(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw error(400, `${label} must be a valid date`);
  return result;
}

export function parseJsonBody(request) {
  return request.json().catch(() => {
    throw error(400, 'Request body must be valid JSON');
  });
}

export function validateUpload(file) {
  if (!(file instanceof File)) throw error(400, 'A file is required');
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    throw error(415, 'Only PDF, JPEG, and PNG files are allowed');
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw error(413, 'File must be between 1 byte and 10 MB');
  }
}

export function validateUploadRequestSize(request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
    throw error(413, 'Multipart request is too large');
  }
}

export function validateFileSignature(buffer, mimeType) {
  const valid =
    (mimeType === 'application/pdf' && buffer.subarray(0, 5).toString() === '%PDF-') ||
    (mimeType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (mimeType === 'image/png' &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  if (!valid) throw error(415, 'File contents do not match the declared MIME type');
}

export function safeUploadName(file) {
  const extension = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png'
  }[file.type];
  const base = file.name
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 80) || 'upload';
  return `${base}.${extension}`;
}

export async function documentMetadata(document, includeDownloadUrl = false) {
  const { cloudKey, privateUrl, ...metadata } = document;
  return {
    ...metadata,
    ...(includeDownloadUrl ? { downloadUrl: await getPresignedUrl(cloudKey, 300) } : {})
  };
}

export async function assetMetadata(asset, includeAccessUrl = false) {
  const { cloudKey, url, ...metadata } = asset;
  let accessUrl;
  if (includeAccessUrl) {
    accessUrl = asset.visibility === 'PUBLIC' && (url?.startsWith('http') || url?.startsWith('/'))
      ? url
      : await getPresignedUrl(cloudKey, 300);
  }
  return { ...metadata, ...(includeAccessUrl ? { accessUrl } : {}) };
}

export function clientIp(request) {
  return (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null)?.slice(0, 255);
}

export function userAgent(request) {
  return request.headers.get('user-agent')?.slice(0, 1000) || null;
}

export async function getEditableHouse(id) {
  const house = await prisma.auctionHouse.findUnique({
    where: { id },
    select: { id: true, onboardingStatus: true }
  });
  if (!house) throw error(404, 'Auction house not found');
  requireEditableStatus(house.onboardingStatus);
  return house;
}
