import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';
import { createInvoiceCheckoutSession, syncInvoiceCheckoutSession } from '$lib/server/invoiceCheckout.js';
import { getStripe } from '$lib/server/stripe.js';
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
      notes: invoice.notes,
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

  if (action === 'send_invoice') {
    if (!invoice.buyer?.email) throw error(409, 'The buyer needs an email address before this invoice can be sent');
    const { deliverBuyerInvoice } = await import('$lib/server/email.js');
    await deliverBuyerInvoice({ invoice, origin: new URL(request.url).origin });
    return json({ sent: true, sentTo: invoice.buyer.email }, { headers: { 'cache-control': 'private, no-store' } });
  }

  if (action === 'record_payment') {
    const method = String(body.method || '').toLowerCase();
    if (!['cash', 'check', 'card'].includes(method)) throw error(400, 'Choose cash, check, or credit card');
    if (['CANCELLED', 'REFUNDED'].includes(invoice.status)) throw error(409, 'This invoice cannot accept payment');
    if (method === 'card') {
      try {
        return json(await createInvoiceCheckoutSession({
          invoiceId: invoice.id, origin: new URL(request.url).origin, sellerUser: user
        }));
      } catch (err) {
        if (err.status) throw error(err.status, err.message);
        console.error('Seller checkout failed', err?.message);
        throw error(502, 'Unable to start Stripe checkout. Check payment configuration and try again.');
      }
    }
    const checkNumber = String(body.checkNumber || '').trim();
    const paymentNote = String(body.notes || '').trim();
    if (method === 'check' && !checkNumber) throw error(400, 'Check number is required');
    if (checkNumber.length > 100 || paymentNote.length > 1000) throw error(400, 'Payment details are too long');
    if (invoice.status === 'PAID') {
      return json({ invoice: publicInvoice(invoice) });
    }
    // Close an outstanding card checkout before accepting an offline payment.
    if (invoice.stripeCheckoutSessionId) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(invoice.stripeCheckoutSessionId);
        if (session.payment_status === 'paid') {
          await syncInvoiceCheckoutSession(session);
          throw error(409, 'This invoice was already paid through Stripe. Refresh to see the payment.');
        }
        if (session.status === 'open') await getStripe().checkout.sessions.expire(session.id);
        else if (session.status === 'complete') throw error(409, 'A card payment is being processed');
      } catch (err) {
        if (err.status) throw err;
        throw error(502, 'Unable to verify the existing Stripe payment. Try again.');
      }
    }
    const details = [method === 'check' ? `Check #${checkNumber}` : 'Cash', paymentNote].filter(Boolean).join(' · ');
    await markInvoicePaid(invoice.id, {
      paymentChannel: 'EXTERNAL',
      externalPaymentMethod: method === 'check' ? 'Check' : 'Cash',
      notes: [invoice.notes, `Payment recorded by ${user.id}: ${details}`].filter(Boolean).join('\n')
    });
    // If a rate was already chosen (buyer pays shipping), buy the label now.
    if (invoice.shipment?.shippoRateId && !invoice.shipment.labelUrl) {
      try {
        await purchaseLabelForInvoice(invoice.id, { requirePaid: true });
      } catch (err) {
        console.error('Label purchase after recording payment failed', err?.message);
      }
    }
    const refreshed = await loadSellerInvoice(params.id, user);
    return json({ invoice: { ...publicInvoice(refreshed), notes: refreshed.notes, buyer: refreshed.buyer } });
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
    return json({ invoice: { ...publicInvoice(refreshed), notes: refreshed.notes, buyer: refreshed.buyer } });
  }

  if (action === 'purchase_label') {
    if (invoice.status !== 'PAID') {
      throw error(409, 'Record payment before purchasing a label');
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
