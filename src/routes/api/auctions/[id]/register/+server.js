import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser } from '$lib/server/authorization.js';
import { auctionRegistrationSchema } from '$lib/zod.js';

export async function POST({ params, locals, request }) {
  try {
    const user = await requireAuthenticatedUser(
      locals,
      'You must be logged in to register for an auction'
    );
    if (!user.isVerifiedBuyer) {
      throw error(403, 'Complete buyer verification before registering for an auction');
    }
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        series: {
          select: {
            registrationOpenOffsetDays: true,
            registrationCloseOffsetMinutes: true
          }
        }
      }
    });
    
    if (!auction) {
      throw error(404, 'Auction not found');
    }
    
    const now = new Date();
    const liveFloorOpen = Boolean(
      auction.auctioneerStartedAt &&
      auction.status === 'LIVE'
    );
    if (auction.status === 'ENDED' || auction.status === 'CANCELLED') {
      throw error(409, 'Registration is closed for this auction');
    }
    if (!liveFloorOpen && now >= auction.endDate) {
      throw error(409, 'Registration is closed for this auction');
    }
    if (auction.series && !liveFloorOpen) {
      const opensAt = new Date(
        auction.startDate.getTime() - auction.series.registrationOpenOffsetDays * 86_400_000
      );
      const closesAt = new Date(
        auction.startDate.getTime() - auction.series.registrationCloseOffsetMinutes * 60_000
      );
      if (now < opensAt) throw error(409, 'Registration is not open yet');
      if (now >= closesAt) throw error(409, 'Registration is closed for this auction');
    }

    if (
      auction.type === 'PUBLIC' &&
      (!auction.platformPolicyId ||
        auction.policyVersionSnapshot == null ||
        !auction.buyerTermsSnapshot)
    ) {
      throw error(409, 'This public auction does not have registration terms');
    }

    const bodyText = await request.text();
    let body = {};
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        throw error(400, 'Invalid JSON body');
      }
    }
    const acceptance = auctionRegistrationSchema.parse(body);
    const acceptedTerms = Boolean(
      acceptance.acceptedTerms ||
      acceptance.termsAccepted ||
      acceptance.policyAccepted
    );

    if (!acceptedTerms) {
      throw error(400, 'You must accept the applicable auction terms and rates');
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const termsAcceptedIp = (forwardedFor?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null)?.slice(0, 255);
    const acceptanceData = {
      termsAcceptedAt: now,
      termsAcceptedIp,
      termsAcceptedUserAgent: request.headers.get('user-agent')?.slice(0, 1000) || null
    };
    const registrationData = auction.type === 'PUBLIC'
      ? {
          status: 'APPROVED',
          acceptedPolicyId: auction.platformPolicyId,
          acceptedPolicyVersion: auction.policyVersionSnapshot,
          acceptedBuyerTermsSnapshot: auction.buyerTermsSnapshot,
          ...acceptanceData
        }
      : {
          status: 'PENDING',
          acceptedBuyerTermsSnapshot: auction.privateHouseBuyerTermsSnapshot,
          ...acceptanceData
        };

    const existingRegistration = await prisma.auctionRegistration.findUnique({
      where: {
        auctionId_userId: {
          auctionId: auction.id,
          userId: user.id
        }
      }
    });
    if (
      auction.type === 'PRIVATE' &&
      existingRegistration &&
      existingRegistration.status !== 'REJECTED'
    ) {
      return json({
        message: existingRegistration.status === 'APPROVED'
          ? 'Registration approved'
          : 'Registration is awaiting auction-house approval',
        registered: existingRegistration.status === 'APPROVED',
        approved: existingRegistration.status === 'APPROVED',
        status: existingRegistration.status
      });
    }

    const registration = await prisma.auctionRegistration.upsert({
      where: {
        auctionId_userId: {
          auctionId: auction.id,
          userId: user.id
        }
      },
      create: {
        auctionId: auction.id,
        userId: user.id,
        ...registrationData
      },
      update: {
        ...registrationData,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null
      }
    });
    
    return json({
      message: registration.status === 'APPROVED'
        ? 'Registration approved'
        : 'Registration submitted for approval',
      registered: registration.status === 'APPROVED',
      approved: registration.status === 'APPROVED',
      status: registration.status
    }, { status: 201 });
  } catch (err) {
    console.error('Error registering for auction:', err);
    if (err.status) {
      throw err;
    }
    if (err.name === 'ZodError') {
      throw error(400, 'Invalid registration data');
    }
    throw error(500, err.message || 'Failed to register for auction');
  }
}

export async function GET({ params, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        type: true,
        status: true,
        platformPolicyId: true,
        policyVersionSnapshot: true,
        buyerTermsSnapshot: true,
        buyerPremiumRateSnapshot: true,
        privateHouseBuyerTermsSnapshot: true,
        privateHouseBuyerPremiumRateSnapshot: true,
        auctioneerStartedAt: true
      }
    });
    if (!auction) throw error(404, 'Auction not found');

    const registration = await prisma.auctionRegistration.findUnique({
      where: {
        auctionId_userId: {
          auctionId: params.id,
          userId: user.id
        }
      }
    });

    const isPublic = auction.type === 'PUBLIC';
    const buyerTerms = isPublic
      ? auction.buyerTermsSnapshot
      : auction.privateHouseBuyerTermsSnapshot;
    const buyerPremiumRate = isPublic
      ? auction.buyerPremiumRateSnapshot
      : auction.privateHouseBuyerPremiumRateSnapshot;

    const policyAccepted = isPublic
      ? Boolean(
          registration?.status === 'APPROVED' &&
          registration.termsAcceptedAt &&
          registration.acceptedPolicyId === auction.platformPolicyId &&
          registration.acceptedPolicyVersion === auction.policyVersionSnapshot &&
          registration.acceptedBuyerTermsSnapshot === auction.buyerTermsSnapshot
        )
      : registration?.status === 'APPROVED';

    const status = registration?.status || null;
    const needsVerification = !user.isVerifiedBuyer;
    const needsTermsAcceptance = Boolean(
      user.isVerifiedBuyer &&
      !policyAccepted &&
      status !== 'PENDING' &&
      status !== 'REJECTED'
    );

    return json({
      registered: !!registration,
      approved: status === 'APPROVED',
      status,
      auctionType: auction.type,
      buyerTerms,
      buyerPremiumRate,
      policyVersion: auction.policyVersionSnapshot,
      isVerifiedBuyer: user.isVerifiedBuyer,
      policyAccepted,
      readyToBid: Boolean(user.isVerifiedBuyer && policyAccepted),
      needsVerification,
      needsTermsAcceptance
    });
  } catch (err) {
    console.error('Error checking registration:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, 'Failed to check registration status');
  }
}
