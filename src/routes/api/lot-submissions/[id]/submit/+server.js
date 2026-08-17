import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  getActivePolicy,
  requireCurrentUser,
  serializeSubmission,
  submissionSelect,
  validatePublicTarget
} from '$lib/server/seller-submissions.js';

export async function POST({ params, request, locals }) {
  const user = await requireCurrentUser(locals);
  if (!user.emailVerifiedAt || !user.phoneVerifiedAt || user.identityVerificationStatus !== 'VERIFIED') {
    throw error(403, 'Verify your email, phone, and identity before submitting a lot');
  }
  if (!user.sellerProfile?.stripeConnectDetailsSubmitted || !user.sellerProfile?.stripeConnectPayoutsEnabled) {
    throw error(403, 'Complete seller tax and bank verification before submitting a lot');
  }
  const body = await request.json().catch(() => {
    throw error(400, 'Request body must be valid JSON');
  });

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be a JSON object');
  }
  if (body.acceptedTerms !== true) {
    throw error(400, 'You must explicitly accept the seller terms before submitting');
  }

  const submission = await prisma.lotSubmission.findFirst({
    where: {
      id: params.id,
      sellerProfile: { userId: user.id }
    },
    select: {
      id: true,
      status: true,
      title: true,
      auctionSeriesId: true,
      auctionId: true
    }
  });
  if (!submission) throw error(404, 'Submission not found');
  if (!['DRAFT', 'REJECTED'].includes(submission.status)) {
    throw error(409, 'Only draft or rejected submissions can be submitted');
  }
  if (!submission.title?.trim()) {
    throw error(400, 'Add a title before submitting');
  }

  const now = new Date();
  await validatePublicTarget(submission, now);
  const policy = await getActivePolicy(now);
  if (!policy) {
    throw error(409, 'Seller submissions are unavailable until an active platform policy is published');
  }
  if (body.policyId !== policy.id || Number(body.policyVersion) !== policy.version) {
    throw error(409, 'The seller terms changed. Review and accept the current terms before submitting');
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const acceptedIp = (forwardedFor?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null)?.slice(0, 255);
  const acceptedUserAgent = request.headers.get('user-agent')?.slice(0, 1000) || null;

  const updated = await prisma.lotSubmission.updateMany({
    where: {
      id: submission.id,
      sellerProfile: { userId: user.id },
      status: { in: ['DRAFT', 'REJECTED'] }
    },
    data: {
      status: 'SUBMITTED',
      submittedAt: now,
      acceptedPolicyId: policy.id,
      acceptedPolicyVersion: policy.version,
      acceptedSellerTermsSnapshot: policy.sellerTerms,
      termsAcceptedAt: now,
      termsAcceptedIp: acceptedIp,
      termsAcceptedUserAgent: acceptedUserAgent,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null
    }
  });
  if (updated.count !== 1) {
    throw error(409, 'This submission was updated elsewhere. Refresh and try again');
  }

  const result = await prisma.lotSubmission.findUnique({
    where: { id: submission.id },
    select: submissionSelect
  });
  return json({ submission: await serializeSubmission(result) });
}
