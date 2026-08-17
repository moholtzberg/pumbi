import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';

export async function POST({ params, request, locals }) {
  const admin = await requirePlatformAdmin(locals);
  const data = await request.json().catch(() => ({}));
  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
  if (!reason) throw error(400, 'A rejection reason is required');
  if (reason.length > 1000) throw error(400, 'Rejection reason is too long');

  const release = await prisma.$transaction(async (tx) => {
    const rejected = await tx.payoutRelease.updateMany({
      where: { id: params.id, status: 'REQUESTED' },
      data: {
        status: 'REJECTED',
        approvedById: admin.id,
        rejectedAt: new Date(),
        stripeError: `Rejection: ${reason}`
      }
    });
    if (rejected.count !== 1) {
      const exists = await tx.payoutRelease.findUnique({
        where: { id: params.id },
        select: { id: true }
      });
      throw error(
        exists ? 409 : 404,
        exists ? 'Payout release is not awaiting review' : 'Payout release not found'
      );
    }
    return tx.payoutRelease.findUnique({
      where: { id: params.id },
      include: {
        auctionHouse: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } }
      }
    });
  }, { isolationLevel: 'Serializable' });

  return json(release);
}
