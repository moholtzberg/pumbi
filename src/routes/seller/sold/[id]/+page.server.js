import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';
import { publicInvoice } from '$lib/server/invoices.js';

export async function load({ locals, params }) {
  const user = await requireAuthenticatedUser(locals);
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      lot: { select: { id: true, lotNumber: true, title: true } },
      auction: { select: { id: true, title: true } },
      auctionHouse: true,
      shipment: true,
      buyer: { select: { id: true, name: true, email: true, phone: true, address: true } }
    }
  });
  if (!invoice) throw error(404, 'Invoice not found');
  await requireAuctionHousePermission(user, invoice.auctionHouseId, HOUSE_PERMISSIONS.MANAGE_AUCTIONS);

  return {
    invoice: {
      ...publicInvoice(invoice),
      buyer: invoice.buyer
    },
    rates: Array.isArray(invoice.shipment?.ratesJson) ? invoice.shipment.ratesJson : [],
    selectedRateId: invoice.shipment?.shippoRateId || null,
    address: {
      name: invoice.shipment?.toName || invoice.buyer.name || '',
      street1: invoice.shipment?.toStreet1 || '',
      street2: invoice.shipment?.toStreet2 || '',
      city: invoice.shipment?.toCity || '',
      state: invoice.shipment?.toState || '',
      zip: invoice.shipment?.toZip || '',
      country: invoice.shipment?.toCountry || 'US',
      phone: invoice.shipment?.toPhone || invoice.buyer.phone || '',
      email: invoice.shipment?.toEmail || invoice.buyer.email || ''
    }
  };
}
