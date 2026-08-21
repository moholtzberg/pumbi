import { redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';
import { HOUSE_ROLES } from '$lib/server/authorization.js';

const CONTROL_ROOM_MEMBERSHIP_ROLES = new Set([
  HOUSE_ROLES.OWNER,
  HOUSE_ROLES.ADMIN,
  HOUSE_ROLES.AUCTION_MANAGER
]);

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
      role: true,
      auctionHouseId: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      identityVerificationStatus: true,
      cardVerificationStatus: true,
      isVerifiedBuyer: true,
      isVerifiedBidder: true,
      auctionHouseMemberships: {
        where: { status: 'ACTIVE' },
        select: { auctionHouseId: true, role: true }
      },
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

  const isPlatformAdmin = user.role === 'PLATFORM_ADMIN';
  const isAuctioneerRole = user.role === 'AUCTIONEER';
  const controlHouseIds = [
    ...new Set([
      ...user.auctionHouseMemberships
        .filter((membership) => CONTROL_ROOM_MEMBERSHIP_ROLES.has(membership.role))
        .map((membership) => membership.auctionHouseId),
      ...(isAuctioneerRole && user.auctionHouseId ? [user.auctionHouseId] : [])
    ])
  ];

  const canSeeControlRooms = isPlatformAdmin || isAuctioneerRole || controlHouseIds.length > 0;

  const [totalBids, leadingLots, wonLotsRaw, recentBids, controlRoomAuctions] = await Promise.all([
    prisma.bid.count({ where: { userId: user.id } }),
    prisma.lot.findMany({
      where: {
        highestBidderId: user.id,
        status: 'ACTIVE'
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        lotNumber: true,
        title: true,
        currentBid: true,
        status: true,
        endTime: true,
        images: {
          where: { isHidden: false },
          orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
          take: 1,
          select: { url: true }
        },
        auction: {
          select: {
            id: true,
            title: true,
            status: true,
            auctionHouse: { select: { name: true } }
          }
        }
      }
    }),
    prisma.lot.findMany({
      where: {
        highestBidderId: user.id,
        status: 'SOLD'
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        lotNumber: true,
        title: true,
        currentBid: true,
        status: true,
        endTime: true,
        updatedAt: true,
        images: {
          where: { isHidden: false },
          orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
          take: 1,
          select: { url: true }
        },
        auction: {
          select: {
            id: true,
            title: true,
            status: true,
            auctionHouse: { select: { name: true } }
          }
        }
      }
    }),
    prisma.bid.findMany({
      where: { userId: user.id },
      take: 5,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        amount: true,
        timestamp: true,
        lot: { select: { id: true, lotNumber: true, title: true, highestBidderId: true, status: true } }
      }
    }),
    canSeeControlRooms
      ? prisma.auction.findMany({
          where: {
            status: { in: ['UPCOMING', 'LIVE'] },
            ...(isPlatformAdmin
              ? {}
              : {
                  OR: [
                    ...(controlHouseIds.length ? [{ auctionHouseId: { in: controlHouseIds } }] : []),
                    { auctioneerId: user.id }
                  ]
                })
          },
          orderBy: [{ status: 'desc' }, { startDate: 'asc' }],
          take: 20,
          select: {
            id: true,
            title: true,
            status: true,
            type: true,
            startDate: true,
            endDate: true,
            auctioneerId: true,
            auctioneerStartedAt: true,
            auctionHouse: { select: { id: true, name: true } },
            _count: { select: { lots: true } }
          }
        })
      : Promise.resolve([])
  ]);

  const mapBuyerLot = async (lot) => ({
    id: lot.id,
    lotNumber: lot.lotNumber,
    title: lot.title,
    currentBid: lot.currentBid,
    status: lot.status,
    endTime: lot.endTime,
    updatedAt: lot.updatedAt || null,
    imageUrl: lot.images[0]?.url ? await convertToPresignedUrl(lot.images[0].url) : null,
    auction: {
      id: lot.auction.id,
      title: lot.auction.title,
      status: lot.auction.status,
      auctionHouseName: lot.auction.auctionHouse?.name || null
    }
  });

  const [watchedLots, leadingLotsMapped, wonLots] = await Promise.all([
    Promise.all(user.watchedLots.map(async ({ lot, createdAt }) => ({
      ...lot,
      watchedAt: createdAt,
      imageUrl: lot.images[0]?.url ? await convertToPresignedUrl(lot.images[0].url) : null,
      images: undefined
    }))),
    Promise.all(leadingLots.map(mapBuyerLot)),
    Promise.all(wonLotsRaw.map(mapBuyerLot))
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      identityVerificationStatus: user.identityVerificationStatus,
      cardVerificationStatus: user.cardVerificationStatus,
      isVerifiedBuyer: user.isVerifiedBuyer,
      isVerifiedBidder: user.isVerifiedBidder
    },
    watchedLots,
    leadingLots: leadingLotsMapped,
    wonLots,
    recentBids,
    controlRoomAuctions: controlRoomAuctions.map((auction) => ({
      id: auction.id,
      title: auction.title,
      status: auction.status,
      type: auction.type,
      startDate: auction.startDate,
      endDate: auction.endDate,
      lotCount: auction._count.lots,
      auctionHouseName: auction.auctionHouse?.name || null,
      isClaimedAuctioneer: auction.auctioneerId === user.id,
      hasStarted: Boolean(auction.auctioneerStartedAt)
    })),
    stats: {
      totalBids,
      leadingBids: leadingLotsMapped.length,
      wonBids: wonLots.length,
      wonValue: wonLots.reduce((sum, lot) => sum + (lot.currentBid || 0), 0),
      winningBids: leadingLotsMapped.length,
      winningValue: leadingLotsMapped.reduce((sum, lot) => sum + (lot.currentBid || 0), 0)
    }
  };
}
