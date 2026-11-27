import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  getActivePolicy,
  getPublicOpportunities,
  getSubmissionCategories,
  readSubmissionInput,
  readSubmissionImages,
  requireCurrentUser,
  serializeSubmission,
  submissionSelect,
  validateDraftTarget
} from '$lib/server/seller-submissions.js';

export async function GET({ locals }) {
  const user = await requireCurrentUser(locals);
  const [profile, opportunities, policy, categories] = await Promise.all([
    prisma.sellerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true }
    }),
    getPublicOpportunities(),
    getActivePolicy(),
    getSubmissionCategories()
  ]);

  const submissions = profile
    ? await prisma.lotSubmission.findMany({
        where: { sellerProfileId: profile.id },
        orderBy: { updatedAt: 'desc' },
        select: submissionSelect
      })
    : [];

  return json({
    submissions: await Promise.all(submissions.map(serializeSubmission)),
    opportunities,
    categories,
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
  const body = await request.json().catch(() => {
    throw error(400, 'Request body must be valid JSON');
  });
  const data = readSubmissionInput(body);
  const images = readSubmissionImages(body.images);
  await validateDraftTarget(data);
  const profile = await prisma.sellerProfile.upsert({
    where: { userId: user.id }, create: { userId: user.id }, update: {}, select: { id: true }
  });

  const submission = await prisma.lotSubmission.create({
    data: {
      ...data,
      sellerProfileId: profile.id,
      ...(images?.length ? { images: { create: images } } : {})
    },
    select: submissionSelect
  });

  return json({ submission: await serializeSubmission(submission) }, { status: 201 });
}
