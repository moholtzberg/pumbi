import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { adminError, requirePlatformAdmin } from '$lib/server/platformAdmin.js';

export async function POST({ params, request, locals }) {
  const admin = await requirePlatformAdmin(locals);
  try {
    const data = await request.json();
    const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
    if (!reason) throw error(400, 'A rejection reason is required');

    const submission = await prisma.$transaction(async (tx) => {
      const reviewed = await tx.lotSubmission.updateMany({
        where: { id: params.id, status: 'SUBMITTED' },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedById: admin.id,
          reviewedAt: new Date()
        }
      });
      if (reviewed.count !== 1) {
        const exists = await tx.lotSubmission.findUnique({ where: { id: params.id }, select: { id: true } });
        throw error(exists ? 409 : 404, exists ? 'This submission is not awaiting review' : 'Lot submission not found');
      }
      return tx.lotSubmission.findUnique({ where: { id: params.id } });
    }, { isolationLevel: 'Serializable' });

    return json(submission);
  } catch (err) {
    adminError(err, 'Failed to reject lot submission');
  }
}
