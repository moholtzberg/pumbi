import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  clientIp,
  onboardingSelect,
  parseJsonBody,
  requireHouseEditor,
  userAgent
} from '$lib/server/auctionHouseOnboarding.js';

const REQUIRED_FIELDS = {
  legalName: 'Legal name',
  businessType: 'Business type',
  registrationNumber: 'Registration number',
  contactFirstName: 'Contact first name',
  contactLastName: 'Contact last name',
  contactEmail: 'Contact email',
  contactPhone: 'Contact phone',
  country: 'Country'
};

export async function POST({ params, request, locals }) {
  const { user } = await requireHouseEditor(locals, params.id);
  if (!user.emailVerifiedAt || !user.phoneVerifiedAt || user.identityVerificationStatus !== 'VERIFIED') {
    throw error(403, 'Verify your email, phone, and identity before submitting auction-house onboarding');
  }
  const body = await parseJsonBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object');
  }
  if (body.acceptedTerms !== true) {
    throw error(400, 'You must explicitly accept the auction-house terms');
  }

  const now = new Date();
  const acceptedIp = clientIp(request);
  const acceptedUserAgent = userAgent(request);
  const auctionHouse = await prisma.$transaction(async (tx) => {
    const policy = await tx.platformPolicy.findFirst({
      where: {
        isActive: true,
        auctionHouseTerms: { not: null },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, auctionHouseTerms: true }
    });
    if (!policy?.auctionHouseTerms?.trim()) {
      throw error(409, 'Onboarding is unavailable until active auction-house terms are published');
    }
    if (body.policyId !== policy.id || Number(body.policyVersion) !== policy.version) {
      throw error(409, 'The auction-house terms changed. Review and accept the current version');
    }

    const house = await tx.auctionHouse.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        onboardingStatus: true,
        stripeConnectDetailsSubmitted: true,
        stripeConnectPayoutsEnabled: true,
        ...Object.fromEntries(Object.keys(REQUIRED_FIELDS).map((field) => [field, true])),
        locations: { where: { isPrimary: true }, select: { id: true }, take: 1 },
        documents: {
          where: { type: { in: ['BUSINESS_LICENSE', 'BANK_VERIFICATION'] } },
          select: { type: true }
        }
      }
    });
    if (!house) throw error(404, 'Auction house not found');
    if (!['DRAFT', 'REJECTED'].includes(house.onboardingStatus)) {
      throw error(409, 'Only draft or rejected onboarding can be submitted');
    }
    if (!house.stripeConnectDetailsSubmitted || !house.stripeConnectPayoutsEnabled) {
      throw error(400, 'Complete Stripe tax and bank verification before submission');
    }
    for (const [field, label] of Object.entries(REQUIRED_FIELDS)) {
      if (typeof house[field] === 'string' ? !house[field].trim() : !house[field]) {
        throw error(400, `${label} is required before submission`);
      }
    }
    if (house.locations.length === 0) {
      throw error(400, 'At least one primary location is required');
    }
    const documentTypes = new Set(house.documents.map((document) => document.type));
    if (!documentTypes.has('BUSINESS_LICENSE') || !documentTypes.has('BANK_VERIFICATION')) {
      throw error(400, 'A business license and bank verification document are required');
    }

    const result = await tx.auctionHouse.updateMany({
      where: { id: params.id, onboardingStatus: { in: ['DRAFT', 'REJECTED'] } },
      data: {
        onboardingStatus: 'SUBMITTED',
        onboardingSubmittedAt: now,
        onboardingReviewedAt: null,
        onboardingApprovedAt: null,
        onboardingRejectedAt: null,
        onboardingReviewedById: null,
        onboardingRejectionReason: null,
        termsVersion: policy.version,
        termsSnapshot: policy.auctionHouseTerms,
        termsAcceptedAt: now,
        termsAcceptedIp: acceptedIp,
        termsAcceptedUserAgent: acceptedUserAgent
      }
    });
    if (result.count !== 1) {
      throw error(409, 'Onboarding changed elsewhere. Refresh and try again');
    }
    return tx.auctionHouse.findUnique({ where: { id: params.id }, select: onboardingSelect });
  }, { isolationLevel: 'Serializable' });

  return json({ auctionHouse });
}
