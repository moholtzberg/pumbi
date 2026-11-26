import { error, redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { shippingDefaults } from '$lib/utils/addresses.js';
import { publicInvoice, sellerPaymentMethods } from '$lib/server/invoices.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';

export async function load({ locals, params, url }) {
  const session = await locals.auth?.();
  if (!session?.user?.email) {
    throw redirect(302, `/auth/login?redirect=/dashboard/invoices/${params.id}`);
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true, phone: true, address: true }
  });
  if (!user) throw redirect(302, '/auth/login');

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      lot: {
        select: {
          id: true,
          lotNumber: true,
          title: true,
          status: true,
          images: {
            where: { isHidden: false },
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
            take: 1,
            select: { url: true }
          }
        }
      },
      auction: { select: { id: true, title: true } },
      auctionHouse: { include: { locations: true } },
      shipment: true
    }
  });
  if (!invoice) throw error(404, 'Invoice not found');
  if (invoice.buyerId !== user.id) throw error(403, 'Not allowed');

  const imageUrl = invoice.lot.images[0]?.url
    ? await convertToPresignedUrl(invoice.lot.images[0].url)
    : null;

  const savedAddresses = await prisma.userAddress.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] });
  const defaults = shippingDefaults(user, savedAddresses, invoice.shipment);
  return {
    user,
    paidFlag: url.searchParams.get('paid') === '1',
    canceledFlag: url.searchParams.get('canceled') === '1',
    invoice: {
      ...publicInvoice(invoice),
      lot: {
        ...publicInvoice(invoice).lot,
        imageUrl
      }
    },
    paymentMethods: [
      { id: 'PUMBI_STRIPE', label: 'Pay with Pumbi', channel: 'PUMBI_STRIPE' },
      ...sellerPaymentMethods(invoice.auctionHouse).map((method) => ({
        id: `EXTERNAL:${method.method}`,
        label: method.method,
        channel: 'EXTERNAL',
        method: method.method
      }))
    ],
    rates: Array.isArray(invoice.shipment?.ratesJson) ? invoice.shipment.ratesJson : [],
    selectedRateId: invoice.shipment?.shippoRateId || null,
    savedAddresses,
    selectedAddressId: defaults.selectedAddressId,
    shippingAddress: defaults.address
  };
}
