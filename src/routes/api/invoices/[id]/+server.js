import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requireAuthenticatedUser } from '$lib/server/authorization.js';
import { publicInvoice, sellerPaymentMethods } from '$lib/server/invoices.js';
import { createInvoiceCheckoutSession } from '$lib/server/invoiceCheckout.js';
import { quoteShippingRates, selectShippingRate } from '$lib/server/shipping.js';

async function loadBuyerInvoice(invoiceId, userId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lot: { select: { id: true, lotNumber: true, title: true, status: true } },
      auction: { select: { id: true, title: true } },
      auctionHouse: true,
      shipment: true
    }
  });
  if (!invoice) throw error(404, 'Invoice not found');
  if (invoice.buyerId !== userId) throw error(403, 'Not allowed');
  return invoice;
}

export async function GET({ params, locals }) {
  const user = await requireAuthenticatedUser(locals);
  const invoice = await loadBuyerInvoice(params.id, user.id);
  return json({
    invoice: publicInvoice(invoice),
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
    selectedRateId: invoice.shipment?.shippoRateId || null
  });
}

export async function POST({ params, locals, request }) {
  const user = await requireAuthenticatedUser(locals);
  const invoice = await loadBuyerInvoice(params.id, user.id);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '').toLowerCase();
  const origin = new URL(request.url).origin;

  if (action === 'quote_shipping') {
    const result = await quoteShippingRates({
      invoiceId: invoice.id,
      addressTo: body.address || {},
      parcelOverrides: body.parcel || {}
    });
    return json(result);
  }

  if (action === 'select_shipping') {
    const result = await selectShippingRate({
      invoiceId: invoice.id,
      rateId: String(body.rateId || '')
    });
    const refreshed = await loadBuyerInvoice(params.id, user.id);
    return json({
      invoice: publicInvoice(refreshed),
      rate: result.rate,
      totals: result.totals
    });
  }

  if (action === 'pay_pumbi') {
    try {
      const session = await createInvoiceCheckoutSession({
        invoiceId: invoice.id,
        origin,
        buyerUser: user
      });
      return json(session);
    } catch (err) {
      if (err.status) throw error(err.status, err.message);
      if (String(err.message || '').includes('STRIPE_SECRET_KEY')) {
        throw error(503, 'Stripe payments are not configured');
      }
      console.error('Checkout creation failed', err);
      throw error(502, err.message || 'Unable to start checkout');
    }
  }

  if (action === 'pay_external') {
    const method = String(body.method || '').trim();
    if (!method) throw error(400, 'Payment method is required');
    const allowed = sellerPaymentMethods(invoice.auctionHouse).some(
      (entry) => entry.method.toLowerCase() === method.toLowerCase()
    );
    if (!allowed) throw error(400, 'That payment method is not offered by this seller');
    if (invoice.buyerPaysShipping && !invoice.shipment?.shippoRateId) {
      throw error(409, 'Choose a shipping option before confirming payment');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'AWAITING_EXTERNAL',
        paymentChannel: 'EXTERNAL',
        externalPaymentMethod: method
      },
      include: {
        lot: { select: { id: true, lotNumber: true, title: true, status: true } },
        auction: { select: { id: true, title: true } },
        auctionHouse: true,
        shipment: true
      }
    });
    return json({ invoice: publicInvoice(updated) });
  }

  throw error(400, 'Unknown action');
}
