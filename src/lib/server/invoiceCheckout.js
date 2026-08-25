import prisma from '$lib/prisma.js';
import { getStripe } from '$lib/server/stripe.js';
import { markInvoicePaid } from '$lib/server/invoices.js';
import { purchaseLabelForInvoice } from '$lib/server/shipping.js';

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

/**
 * Create a Stripe Checkout Session for an unpaid invoice (Pay with Pumbi).
 */
export async function createInvoiceCheckoutSession({ invoiceId, origin, buyerUser }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lot: { select: { id: true, title: true, lotNumber: true } },
      auction: { select: { id: true, title: true } },
      auctionHouse: true,
      shipment: true,
      buyer: { select: { id: true, email: true, stripeCustomerId: true } }
    }
  });

  if (!invoice) {
    const error = new Error('Invoice not found');
    error.status = 404;
    throw error;
  }
  if (invoice.buyerId !== buyerUser.id) {
    const error = new Error('Not allowed to pay this invoice');
    error.status = 403;
    throw error;
  }
  if (invoice.status === 'PAID') {
    const error = new Error('Invoice is already paid');
    error.status = 409;
    throw error;
  }
  if (invoice.buyerPaysShipping && (!invoice.shipment?.shippoRateId || Number(invoice.shippingAmount) <= 0)) {
    const error = new Error('Choose a shipping option before paying');
    error.status = 409;
    throw error;
  }

  const stripe = getStripe();
  const currency = (invoice.currency || 'usd').toLowerCase();
  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency,
        unit_amount: toCents(invoice.hammerPrice),
        product_data: {
          name: `Lot #${invoice.lot.lotNumber} · ${invoice.lot.title}`,
          description: `${invoice.auction.title} — hammer price`
        }
      }
    }
  ];

  if (Number(invoice.buyerPremiumAmount) > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: toCents(invoice.buyerPremiumAmount),
        product_data: {
          name: `Buyer’s premium (${Number(invoice.buyerPremiumRate)}%)`,
          description: invoice.auctionHouse.name
        }
      }
    });
  }

  if (Number(invoice.shippingAmount) > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: toCents(invoice.shippingAmount),
        product_data: {
          name: `Shipping · ${invoice.shipment?.carrier || 'Carrier'} ${invoice.shipment?.serviceLevel || ''}`.trim(),
          description: 'Selected shipping option'
        }
      }
    });
  }

  const sessionParams = {
    mode: 'payment',
    customer_email: invoice.buyer.email || buyerUser.email,
    line_items: lineItems,
    success_url: `${origin}/dashboard/invoices/${invoice.id}?paid=1`,
    cancel_url: `${origin}/dashboard/invoices/${invoice.id}?canceled=1`,
    client_reference_id: invoice.id,
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      lotId: invoice.lotId,
      auctionHouseId: invoice.auctionHouseId
    },
    payment_intent_data: {
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number
      }
    }
  };

  if (
    invoice.auctionHouse.stripeConnectAccountId &&
    invoice.auctionHouse.stripeConnectChargesEnabled
  ) {
    // Destination charge to the auction house Connect account.
    // Platform fee can be added later via application_fee_amount.
    sessionParams.payment_intent_data.transfer_data = {
      destination: invoice.auctionHouse.stripeConnectAccountId
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: 'PENDING_CHECKOUT',
      paymentChannel: 'PUMBI_STRIPE',
      stripeCheckoutSessionId: session.id
    }
  });

  return { url: session.url, sessionId: session.id };
}

export async function syncInvoiceCheckoutSession(session) {
  if (!session || session.mode !== 'payment') return null;
  const invoiceId = session.metadata?.invoiceId || session.client_reference_id;
  if (!invoiceId) return null;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { shipment: true }
  });
  if (!invoice) return null;
  if (invoice.status === 'PAID') return invoice;

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return invoice;
  }

  const paid = await markInvoicePaid(invoice.id, {
    paymentChannel: 'PUMBI_STRIPE',
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null
  });

  // Buyer-selected shipping: buy the label automatically so the seller can print it.
  if (invoice.shipment?.shippoRateId && !invoice.shipment.labelUrl) {
    try {
      await purchaseLabelForInvoice(invoice.id, { requirePaid: true });
    } catch (err) {
      console.error('Auto label purchase failed for invoice', invoice.id, err?.message);
    }
  }

  return paid;
}
