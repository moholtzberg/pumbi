import { redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';

export async function load({ locals, url }) {
  const user = await requireAuthenticatedUser(locals);

  const membershipHouseId = user.auctionHouseMemberships?.find((m) => m.status === 'ACTIVE')
    ?.auctionHouseId;
  const auctionHouseId = membershipHouseId || user.auctionHouseId;
  if (!auctionHouseId) throw redirect(302, '/seller/onboarding');

  await requireAuctionHousePermission(user, auctionHouseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);

  const statusFilter = url.searchParams.get('status') || 'all';
  const invoices = await prisma.invoice.findMany({
    where: {
      auctionHouseId,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      lot: {
        select: {
          id: true,
          lotNumber: true,
          title: true,
          images: {
            where: { isHidden: false },
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
            take: 1,
            select: { url: true }
          }
        }
      },
      auction: { select: { id: true, title: true } },
      buyer: { select: { id: true, name: true, email: true } },
      shipment: true
    }
  });

  return {
    statusFilter,
    invoices: await Promise.all(
      invoices.map(async (invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        hammerPrice: Number(invoice.hammerPrice),
        buyerPremiumAmount: Number(invoice.buyerPremiumAmount),
        shippingAmount: Number(invoice.shippingAmount),
        totalAmount: Number(invoice.totalAmount),
        buyerPaysShipping: invoice.buyerPaysShipping,
        paymentChannel: invoice.paymentChannel,
        externalPaymentMethod: invoice.externalPaymentMethod,
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
        buyer: invoice.buyer,
        auction: invoice.auction,
        lot: {
          id: invoice.lot.id,
          lotNumber: invoice.lot.lotNumber,
          title: invoice.lot.title,
          imageUrl: invoice.lot.images[0]?.url
            ? await convertToPresignedUrl(invoice.lot.images[0].url)
            : null
        },
        shipment: invoice.shipment
          ? {
              id: invoice.shipment.id,
              status: invoice.shipment.status,
              carrier: invoice.shipment.carrier,
              serviceLevel: invoice.shipment.serviceLevel,
              trackingNumber: invoice.shipment.trackingNumber,
              trackingUrl: invoice.shipment.trackingUrl,
              labelUrl: invoice.shipment.labelUrl,
              trackingStatusDetail: invoice.shipment.trackingStatusDetail
            }
          : null
      }))
    )
  };
}
