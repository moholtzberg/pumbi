import { redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';

export async function load({ locals }) {
  const session = await locals.auth?.();
  if (!session?.user?.email) throw redirect(302, '/auth/login?redirect=/dashboard');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      address: true,
      isVerifiedBuyer: true,
      isVerifiedBidder: true,
      watchedLots: {
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          lot: {
            select: {
              id: true,
              lotNumber: true,
              title: true,
              currentBid: true,
              startingBid: true,
              status: true,
              endTime: true,
              images: {
                where: { isHidden: false },
                orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
                take: 1,
                select: { url: true }
              },
              auction: { select: { id: true, title: true, status: true, startDate: true, endDate: true } }
            }
          }
        }
      }
    }
  });
  if (!user) throw redirect(302, '/auth/login?redirect=/dashboard');

  const [totalBids, winningLots, recentBids] = await Promise.all([
    prisma.bid.count({ where: { userId: user.id } }),
    prisma.lot.findMany({
      where: { highestBidderId: user.id },
      select: { id: true, currentBid: true }
    }),
    prisma.bid.findMany({
      where: { userId: user.id },
      take: 5,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        amount: true,
        timestamp: true,
        lot: { select: { id: true, lotNumber: true, title: true, highestBidderId: true } }
      }
    })
  ]);

  const watchedLots = await Promise.all(user.watchedLots.map(async ({ lot, createdAt }) => ({
    ...lot,
    watchedAt: createdAt,
    imageUrl: lot.images[0]?.url ? await convertToPresignedUrl(lot.images[0].url) : null,
    images: undefined
  })));

  return {
    user: { ...user, watchedLots: undefined },
    watchedLots,
    recentBids,
    stats: {
      totalBids,
      winningBids: winningLots.length,
      winningValue: winningLots.reduce((sum, lot) => sum + lot.currentBid, 0)
    }
  };
}
