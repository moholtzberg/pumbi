import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';
import { publicInvoice, markInvoicePaid } from '$lib/server/invoices.js';
import { purchaseLabelForInvoice, quoteShippingRates, selectShippingRate } from '$lib/server/shipping.js';

async function loadSellerInvoice(invoiceId, user) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lot: { select: { id: true, lotNumber: true, title: true, status: true } },
      auction: { select: { id: true, title: true } },
      auctionHouse: true,
      shipment: true,
      buyer: { select: { id: true, name: true, email: true, phone: true } }
    }
  });
  if (!invoice) throw error(404, 'Invoice not found');
  await requireAuctionHousePermission(
    user,
    invoice.auctionHouseId,
    HOUSE_PERMISSIONS.MANAGE_AUCTIONS
  );
  return invoice;
}

export async function GET({ params, locals }) {
  const user = await requireAuthenticatedUser(locals);
  const invoice = await loadSellerInvoice(params.id, user);
  return json({
    invoice: {
      ...publicInvoice(invoice),
      buyer: invoice.buyer
    },
    rates: Array.isArray(invoice.shipment?.ratesJson) ? invoice.shipment.ratesJson : [],
    selectedRateId: invoice.shipment?.shippoRateId || null
  });
}

export async function POST({ params, locals, request }) {
  const user = await requireAuthenticatedUser(locals);
  const invoice = await loadSellerInvoice(params.id, user);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '').toLowerCase();

  if (action === 'mark_paid') {
    if (invoice.status === 'PAID') {
      return json({ invoice: publicInvoice(invoice) });
    }
    const updated = await markInvoicePaid(invoice.id, {
      paymentChannel: invoice.paymentChannel || 'EXTERNAL',
      externalPaymentMethod: invoice.externalPaymentMethod || body.method || 'Manual'
    });
    // If a rate was already chosen (buyer pays shipping), buy the label now.
    if (invoice.shipment?.shippoRateId && !invoice.shipment.labelUrl) {
      try {
        await purchaseLabelForInvoice(invoice.id, { requirePaid: true });
      } catch (err) {
        console.error('Label purchase after mark_paid failed', err?.message);
      }
    }
    const refreshed = await loadSellerInvoice(params.id, user);
    return json({ invoice: { ...publicInvoice(refreshed), buyer: refreshed.buyer } });
  }

  if (action === 'quote_shipping') {
    const result = await quoteShippingRates({
      invoiceId: invoice.id,
      addressTo: body.address || {
        name: invoice.buyer.name,
        street1: body.street1,
        street2: body.street2,
        city: body.city,
        state: body.state,
        zip: body.zip,
        country: body.country || 'US',
        phone: invoice.buyer.phone,
        email: invoice.buyer.email
      },
      parcelOverrides: body.parcel || {}
    });
    return json(result);
  }

  if (action === 'select_shipping') {
    await selectShippingRate({ invoiceId: invoice.id, rateId: String(body.rateId || '') });
    const refreshed = await loadSellerInvoice(params.id, user);
    return json({ invoice: { ...publicInvoice(refreshed), buyer: refreshed.buyer } });
  }

  if (action === 'purchase_label') {
    if (invoice.status !== 'PAID') {
      throw error(409, 'Mark the invoice paid before purchasing a label');
    }
    try {
      const shipment = await purchaseLabelForInvoice(invoice.id, { requirePaid: true });
      return json({ shipment });
    } catch (err) {
      if (err.status) throw error(err.status, err.message);
      throw error(502, err.message || 'Unable to purchase label');
    }
  }

  throw error(400, 'Unknown action');
}
