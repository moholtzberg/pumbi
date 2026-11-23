import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';
import { getStripe } from '$lib/server/stripe.js';
import { syncInvoiceCheckoutSession } from '$lib/server/invoiceCheckout.js';
import { publicInvoice } from '$lib/server/invoices.js';

export async function load({ locals, params, url }) {
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

  let paymentNotice = url.searchParams.has('canceled') ? 'Card payment canceled. No payment was recorded.' : '';
  if (url.searchParams.get('paid') === '1' && invoice.stripeCheckoutSessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(invoice.stripeCheckoutSessionId);
      const synced = await syncInvoiceCheckoutSession(session);
      if (synced) Object.assign(invoice, synced);
      paymentNotice = invoice.status === 'PAID' ? 'Card payment recorded.' : 'Stripe is confirming the payment. Refresh to check its status.';
    } catch (err) {
      console.error('Seller payment sync failed', err?.message);
      paymentNotice = 'Unable to check Stripe payment status. Refresh to try again.';
    }
  }

  return {
    paymentNotice,
    invoice: {
      ...publicInvoice(invoice),
      notes: invoice.notes,
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
