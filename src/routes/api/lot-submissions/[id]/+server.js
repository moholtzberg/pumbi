import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  readSubmissionInput,
  readSubmissionImages,
  requireCurrentUser,
  serializeSubmission,
  submissionSelect,
  validatePublicTarget
} from '$lib/server/seller-submissions.js';

export async function PATCH({ params, request, locals }) {
  const user = await requireCurrentUser(locals);
  const existing = await prisma.lotSubmission.findFirst({
    where: {
      id: params.id,
      sellerProfile: { userId: user.id }
    },
    select: {
      id: true,
      status: true,
      auctionSeriesId: true,
      auctionId: true
    }
  });

  if (!existing) throw error(404, 'Submission not found');
  if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
    throw error(409, 'Only draft or rejected submissions can be edited');
  }

  const body = await request.json().catch(() => {
    throw error(400, 'Request body must be valid JSON');
  });
  const data = readSubmissionInput(body);
  const images = readSubmissionImages(body.images);
  const target = {
    auctionSeriesId:
      data.auctionSeriesId === undefined ? existing.auctionSeriesId : data.auctionSeriesId,
    auctionId: data.auctionId === undefined ? existing.auctionId : data.auctionId
  };
  await validatePublicTarget(target);

  const submission = await prisma.lotSubmission.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(images === undefined ? {} : { images: { deleteMany: {}, create: images } })
    },
    select: submissionSelect
  });

  return json({ submission: await serializeSubmission(submission) });
}

export const PUT = PATCH;
