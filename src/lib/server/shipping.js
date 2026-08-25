import prisma from '$lib/prisma.js';
import { recalculateInvoiceTotals } from '$lib/server/invoices.js';
import {
  createShippoShipment,
  purchaseShippoLabel,
  mapShippoTrackingStatus,
  isShippoConfigured
} from '$lib/server/shippo.js';

function parseSettings(settings) {
  if (!settings) return {};
  try {
    return typeof settings === 'object' ? settings : JSON.parse(settings || '{}');
  } catch {
    return {};
  }
}

function warehouseFromHouse(house) {
  const settings = parseSettings(house?.settings);
  const locations = house?.locations || [];
  const warehouse =
    locations.find((loc) => loc.type === 'WAREHOUSE' && loc.isPrimary) ||
    locations.find((loc) => loc.type === 'WAREHOUSE') ||
    locations[0] ||
    null;

  if (warehouse) {
    return {
      name: warehouse.name || house.name || 'Auction house',
      street1: warehouse.addressLine1 || '1 Main St',
      street2: warehouse.addressLine2 || '',
      city: warehouse.city || 'New York',
      state: warehouse.stateProvince || 'NY',
      zip: warehouse.postalCode || '10001',
      country: warehouse.country || 'US',
      phone: warehouse.contactPhone || house.contactPhone || '',
      email: warehouse.contactEmail || house.contactEmail || settings.email || ''
    };
  }

  return {
    name: house?.name || 'Auction house',
    street1: settings.addressInEnglish || '1 Main St',
    street2: '',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: house?.country || 'US',
    phone: house?.contactPhone || '',
    email: house?.contactEmail || settings.email || ''
  };
}

function defaultParcel(settings = {}) {
  return {
    weightOz: Number(settings.defaultParcelWeightOz) || 16,
    lengthIn: Number(settings.defaultParcelLengthIn) || 12,
    widthIn: Number(settings.defaultParcelWidthIn) || 10,
    heightIn: Number(settings.defaultParcelHeightIn) || 6
  };
}

export async function getOrCreateShipmentDraft(invoiceId) {
  const existing = await prisma.shipment.findUnique({ where: { invoiceId } });
  if (existing) return existing;
  return prisma.shipment.create({
    data: { invoiceId, status: 'DRAFT' }
  });
}

export async function quoteShippingRates({
  invoiceId,
  addressTo,
  parcelOverrides = {}
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      auctionHouse: { include: { locations: true } },
      buyer: { select: { name: true, email: true, phone: true } },
      shipment: true
    }
  });
  if (!invoice) {
    const error = new Error('Invoice not found');
    error.status = 404;
    throw error;
  }
  if (!['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'].includes(invoice.status)) {
    const error = new Error('Shipping can only be quoted on unpaid invoices');
    error.status = 409;
    throw error;
  }

  const houseSettings = parseSettings(invoice.auctionHouse.settings);
  const from = warehouseFromHouse(invoice.auctionHouse);
  const parcel = { ...defaultParcel(houseSettings), ...parcelOverrides };
  const to = {
    name: addressTo.name || invoice.buyer.name || 'Buyer',
    street1: addressTo.street1,
    street2: addressTo.street2 || '',
    city: addressTo.city,
    state: addressTo.state,
    zip: addressTo.zip,
    country: addressTo.country || 'US',
    phone: addressTo.phone || invoice.buyer.phone || '',
    email: addressTo.email || invoice.buyer.email || ''
  };

  for (const key of ['street1', 'city', 'state', 'zip']) {
    if (!to[key]) {
      const error = new Error(`Shipping address ${key} is required`);
      error.status = 400;
      throw error;
    }
  }

  const quoted = await createShippoShipment({
    addressFrom: from,
    addressTo: to,
    parcel
  });

  const shipment = await prisma.shipment.upsert({
    where: { invoiceId },
    create: {
      invoiceId,
      status: 'RATES_READY',
      shippoShipmentId: quoted.objectId,
      fromName: from.name,
      fromStreet1: from.street1,
      fromStreet2: from.street2,
      fromCity: from.city,
      fromState: from.state,
      fromZip: from.zip,
      fromCountry: from.country,
      toName: to.name,
      toStreet1: to.street1,
      toStreet2: to.street2,
      toCity: to.city,
      toState: to.state,
      toZip: to.zip,
      toCountry: to.country,
      toPhone: to.phone,
      toEmail: to.email,
      parcelWeightOz: parcel.weightOz,
      parcelLengthIn: parcel.lengthIn,
      parcelWidthIn: parcel.widthIn,
      parcelHeightIn: parcel.heightIn,
      ratesJson: quoted.rates
    },
    update: {
      status: 'RATES_READY',
      shippoShipmentId: quoted.objectId,
      fromName: from.name,
      fromStreet1: from.street1,
      fromStreet2: from.street2,
      fromCity: from.city,
      fromState: from.state,
      fromZip: from.zip,
      fromCountry: from.country,
      toName: to.name,
      toStreet1: to.street1,
      toStreet2: to.street2,
      toCity: to.city,
      toState: to.state,
      toZip: to.zip,
      toCountry: to.country,
      toPhone: to.phone,
      toEmail: to.email,
      parcelWeightOz: parcel.weightOz,
      parcelLengthIn: parcel.lengthIn,
      parcelWidthIn: parcel.widthIn,
      parcelHeightIn: parcel.heightIn,
      ratesJson: quoted.rates,
      shippoRateId: null,
      shippingAmount: null,
      carrier: null,
      serviceLevel: null
    }
  });

  return {
    shipmentId: shipment.id,
    shippoConfigured: isShippoConfigured(),
    rates: quoted.rates
  };
}

export async function selectShippingRate({ invoiceId, rateId }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { shipment: true }
  });
  if (!invoice?.shipment) {
    const error = new Error('Get shipping rates before selecting one');
    error.status = 409;
    throw error;
  }
  if (!['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'].includes(invoice.status)) {
    const error = new Error('Cannot change shipping on a paid invoice');
    error.status = 409;
    throw error;
  }

  const rates = Array.isArray(invoice.shipment.ratesJson) ? invoice.shipment.ratesJson : [];
  const rate = rates.find((entry) => entry.objectId === rateId);
  if (!rate) {
    const error = new Error('Selected shipping rate is no longer available');
    error.status = 400;
    throw error;
  }

  const totals = recalculateInvoiceTotals({
    hammerPrice: invoice.hammerPrice,
    buyerPremiumRate: invoice.buyerPremiumRate,
    shippingAmount: invoice.buyerPaysShipping ? rate.amount : 0
  });

  const [shipment] = await prisma.$transaction([
    prisma.shipment.update({
      where: { id: invoice.shipment.id },
      data: {
        shippoRateId: rate.objectId,
        carrier: rate.provider,
        serviceLevel: rate.servicelevel,
        shippingAmount: rate.amount,
        currency: rate.currency || 'usd'
      }
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        shippingAmount: totals.shippingAmount,
        totalAmount: totals.totalAmount
      }
    })
  ]);

  return { shipment, totals, rate };
}

export async function purchaseLabelForInvoice(invoiceId, { requirePaid = true } = {}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { shipment: true }
  });
  if (!invoice) {
    const error = new Error('Invoice not found');
    error.status = 404;
    throw error;
  }
  if (requirePaid && invoice.status !== 'PAID') {
    const error = new Error('Pay the invoice before purchasing a shipping label');
    error.status = 409;
    throw error;
  }
  if (!invoice.shipment?.shippoRateId) {
    const error = new Error('Select a shipping rate before creating a label');
    error.status = 409;
    throw error;
  }
  if (invoice.shipment.labelUrl || invoice.shipment.trackingNumber) {
    return invoice.shipment;
  }

  const purchased = await purchaseShippoLabel(invoice.shipment.shippoRateId, {
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.number }
  });

  return prisma.shipment.update({
    where: { id: invoice.shipment.id },
    data: {
      status: 'LABEL_PURCHASED',
      shippoTransactionId: purchased.objectId,
      trackingNumber: purchased.trackingNumber,
      trackingUrl: purchased.trackingUrlProvider,
      labelUrl: purchased.labelUrl,
      labeledAt: new Date(),
      carrier: purchased.rate?.provider || invoice.shipment.carrier,
      serviceLevel: purchased.rate?.servicelevel || invoice.shipment.serviceLevel
    }
  });
}

export async function applyShippoTrackingUpdate({
  trackingNumber,
  status,
  statusDetails,
  eta,
  trackingUrl,
  events
}) {
  if (!trackingNumber) return null;
  const shipment = await prisma.shipment.findFirst({
    where: { trackingNumber: String(trackingNumber) }
  });
  if (!shipment) return null;

  const mapped = mapShippoTrackingStatus(status);
  const data = {
    status: mapped,
    trackingStatusDetail: statusDetails || shipment.trackingStatusDetail,
    trackingUrl: trackingUrl || shipment.trackingUrl,
    trackingEventsJson: events || shipment.trackingEventsJson,
    eta: eta ? new Date(eta) : shipment.eta
  };
  if (mapped === 'IN_TRANSIT' && !shipment.shippedAt) data.shippedAt = new Date();
  if (mapped === 'DELIVERED') data.deliveredAt = new Date();

  return prisma.shipment.update({
    where: { id: shipment.id },
    data
  });
}
