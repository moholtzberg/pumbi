import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  documentMetadata,
  onboardingSelect,
  optionalString,
  parseJsonBody
} from '$lib/server/auctionHouseOnboarding.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';

const REVIEW_STATUSES = new Set(['UNDER_REVIEW', 'APPROVED', 'REJECTED']);
const DOCUMENT_REVIEW_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);

export async function GET({ params, locals }) {
  await requirePlatformAdmin(locals);
  const auctionHouse = await prisma.auctionHouse.findUnique({
    where: { id: params.id },
    select: {
      ...onboardingSelect,
      onboardingReviewedBy: { select: { id: true, name: true, email: true } }
    }
  });
  if (!auctionHouse) throw error(404, 'Auction house not found');
  const documents = await prisma.auctionHouseDocument.findMany({
    where: { auctionHouseId: params.id },
    orderBy: { createdAt: 'desc' }
  });
  return json({
    auctionHouse: {
      ...auctionHouse,
      documents: await Promise.all(documents.map((document) => documentMetadata(document, true)))
    }
  });
}

export async function PATCH({ params, request, locals }) {
  const admin = await requirePlatformAdmin(locals);
  const body = await parseJsonBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object');
  }
  if (!REVIEW_STATUSES.has(body.status)) throw error(400, 'Invalid review status');
  const rejectionReason = optionalString(body.rejectionReason, 'Rejection reason', 2000);
  if (body.status === 'REJECTED' && !rejectionReason) {
    throw error(400, 'Rejection reason is required');
  }
  const documentReviews = body.documentReviews ?? [];
  if (!Array.isArray(documentReviews)) throw error(400, 'Document reviews must be an array');

  const seenDocumentIds = new Set();
  for (const review of documentReviews) {
    if (!review || typeof review !== 'object' || typeof review.documentId !== 'string') {
      throw error(400, 'Each document review must include a documentId');
    }
    if (seenDocumentIds.has(review.documentId)) throw error(400, 'Duplicate document review');
    seenDocumentIds.add(review.documentId);
    if (!DOCUMENT_REVIEW_STATUSES.has(review.status)) {
      throw error(400, 'Invalid document review status');
    }
    optionalString(review.notes, 'Document review notes', 2000);
  }

  const now = new Date();
  const auctionHouse = await prisma.$transaction(async (tx) => {
    const current = await tx.auctionHouse.findUnique({
      where: { id: params.id },
      select: { id: true, onboardingStatus: true }
    });
    if (!current) throw error(404, 'Auction house not found');
    const allowedCurrentStatuses = body.status === 'UNDER_REVIEW'
      ? ['SUBMITTED']
      : ['SUBMITTED', 'UNDER_REVIEW'];
    if (!allowedCurrentStatuses.includes(current.onboardingStatus)) {
      throw error(409, `Cannot mark ${current.onboardingStatus} onboarding as ${body.status}`);
    }

    if (documentReviews.length > 0) {
      const documents = await tx.auctionHouseDocument.findMany({
        where: { id: { in: [...seenDocumentIds] }, auctionHouseId: params.id },
        select: { id: true }
      });
      if (documents.length !== seenDocumentIds.size) {
        throw error(400, 'One or more documents do not belong to this auction house');
      }
      for (const review of documentReviews) {
        await tx.auctionHouseDocument.update({
          where: { id: review.documentId },
          data: {
            reviewStatus: review.status,
            reviewedById: review.status === 'PENDING' ? null : admin.id,
            reviewedAt: review.status === 'PENDING' ? null : now,
            reviewNotes: optionalString(review.notes, 'Document review notes', 2000)
          }
        });
      }
    }

    if (body.status === 'APPROVED') {
      const approvedRequiredDocuments = await tx.auctionHouseDocument.findMany({
        where: {
          auctionHouseId: params.id,
          type: { in: ['BUSINESS_LICENSE', 'BANK_VERIFICATION'] },
          reviewStatus: 'APPROVED'
        },
        select: { type: true }
      });
      const approvedTypes = new Set(approvedRequiredDocuments.map((document) => document.type));
      if (!approvedTypes.has('BUSINESS_LICENSE') || !approvedTypes.has('BANK_VERIFICATION')) {
        throw error(400, 'Business license and bank verification must be approved first');
      }
    }

    await tx.auctionHouse.update({
      where: { id: params.id },
      data: {
        onboardingStatus: body.status,
        onboardingReviewedById: admin.id,
        onboardingReviewedAt: now,
        onboardingApprovedAt: body.status === 'APPROVED' ? now : null,
        onboardingRejectedAt: body.status === 'REJECTED' ? now : null,
        onboardingRejectionReason: body.status === 'REJECTED' ? rejectionReason : null,
        ...(body.status === 'APPROVED' ? { isActive: true } : {})
      }
    });
    return tx.auctionHouse.findUnique({ where: { id: params.id }, select: onboardingSelect });
  });

  return json({ auctionHouse });
}
