import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  getActivePolicy,
  getPublicOpportunities,
  readSubmissionInput,
  requireCurrentUser,
  serializeSubmission,
  submissionSelect,
  validatePublicTarget
} from '$lib/server/seller-submissions.js';

export async function GET({ locals }) {
  const user = await requireCurrentUser(locals);
  const [profile, opportunities, policy] = await Promise.all([
    prisma.sellerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true }
    }),
    getPublicOpportunities(),
    getActivePolicy()
  ]);

  const submissions = profile
    ? await prisma.lotSubmission.findMany({
        where: { sellerProfileId: profile.id },
        orderBy: { updatedAt: 'desc' },
        select: submissionSelect
      })
    : [];

  return json({
    submissions: submissions.map(serializeSubmission),
    opportunities,
    policy: policy
      ? {
          ...policy,
          sellerCommissionRate: policy.sellerCommissionRate.toString()
        }
      : null
  });
}

export async function POST({ request, locals }) {
  const user = await requireCurrentUser(locals);
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });
  if (!profile) {
    throw error(400, 'Create your seller profile before starting a submission');
  }

  const body = await request.json().catch(() => {
    throw error(400, 'Request body must be valid JSON');
  });
  const data = readSubmissionInput(body);
  await validatePublicTarget(data);

  const submission = await prisma.lotSubmission.create({
    data: { ...data, sellerProfileId: profile.id },
    select: submissionSelect
  });

  return json({ submission: serializeSubmission(submission) }, { status: 201 });
}
