import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { isPlatformAdmin, requireAuthenticatedUser } from '$lib/server/authorization.js';

export async function PATCH({ params, request, locals }) {
  const admin = await requireAuthenticatedUser(locals);
  if (!isPlatformAdmin(admin)) throw error(403, 'Platform administrator access required');
  const body = await request.json().catch(() => { throw error(400, 'Request body must be valid JSON'); });
  if (typeof body.isVerifiedBidder !== 'boolean') throw error(400, 'isVerifiedBidder must be a boolean');

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) throw error(404, 'User not found');
  if (body.isVerifiedBidder && !user.isVerifiedBuyer) {
    throw error(409, 'Buyer verification must be complete before bidder approval');
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isVerifiedBidder: body.isVerifiedBidder },
    select: { id: true, email: true, isVerifiedBuyer: true, isVerifiedBidder: true }
  });
  return json({ message: 'Bidder approval updated', user: updated });
}
