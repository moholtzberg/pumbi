import prisma from '$lib/prisma.js';

function parseSettings(settings) {
  if (!settings) return {};
  if (typeof settings === 'object') return settings;
  try {
    const parsed = JSON.parse(settings);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function resolveBuyerPremiumRate({ auction, auctionHouse } = {}) {
  const auctionRate = toNumber(auction?.buyerPremiumRateSnapshot, NaN);
  if (Number.isFinite(auctionRate)) return auctionRate;

  const privateRate = toNumber(auction?.privateHouseBuyerPremiumRateSnapshot, NaN);
  if (Number.isFinite(privateRate)) return privateRate;

  const houseSettings = parseSettings(auctionHouse?.settings);
  const houseRate = toNumber(houseSettings.buyersPremium, NaN);
  if (Number.isFinite(houseRate)) return houseRate;

  const auctionSettings = parseSettings(auction?.settings);
  const auctionSettingsRate = toNumber(auctionSettings.buyersPremium, NaN);
  if (Number.isFinite(auctionSettingsRate)) return auctionSettingsRate;

  return 0;
}

export function resolveBuyerPaysShipping({ auction, auctionHouse } = {}) {
  const auctionSettings = parseSettings(auction?.settings);
  if (typeof auctionSettings.buyerPaysShipping === 'boolean') {
    return auctionSettings.buyerPaysShipping;
  }
  const houseSettings = parseSettings(auctionHouse?.settings);
  if (typeof houseSettings.buyerPaysShipping === 'boolean') {
    return houseSettings.buyerPaysShipping;
  }
  return true;
}

export function sellerPaymentMethods(auctionHouse) {
  const settings = parseSettings(auctionHouse?.settings);
  const methods = Array.isArray(settings.paymentMethods) ? settings.paymentMethods : [];
  return methods
    .map((entry) => ({
      method: String(entry?.method || '').trim(),
      percentage: toNumber(entry?.percentage, 0),
      vat: Boolean(entry?.vat)
    }))
    .filter((entry) => entry.method);
}

function invoiceNumber(lot) {
  const year = new Date().getFullYear();
  const lotPart = String(lot.lotNumber || 0).padStart(3, '0');
  const idPart = String(lot.id || '').slice(-6).toUpperCase();
  return `INV-${year}-${lotPart}-${idPart}`;
}

export function recalculateInvoiceTotals({
  hammerPrice,
  buyerPremiumRate,
  shippingAmount = 0
}) {
  const hammer = money(hammerPrice);
  const rate = money(buyerPremiumRate);
  const premium = money((hammer * rate) / 100);
  const shipping = money(shippingAmount);
  return {
    hammerPrice: hammer,
    buyerPremiumRate: rate,
    buyerPremiumAmount: premium,
    shippingAmount: shipping,
    totalAmount: money(hammer + premium + shipping)
  };
}

/**
 * Create (or return existing) seller invoice when a lot is hammered SOLD.
 */
export async function createInvoiceForSoldLot(lotId) {
  const existing = await prisma.invoice.findUnique({ where: { lotId } });
  if (existing) return existing;

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      auction: { include: { auctionHouse: true } }
    }
  });
  if (!lot) throw new Error('Lot not found');
  if (lot.status !== 'SOLD') throw new Error('Invoice can only be created for sold lots');
  if (!lot.highestBidderId) throw new Error('Sold lot is missing a buyer');

  const auction = lot.auction;
  const house = auction.auctionHouse;
  const buyerPremiumRate = resolveBuyerPremiumRate({ auction, auctionHouse: house });
  const buyerPaysShipping = resolveBuyerPaysShipping({ auction, auctionHouse: house });
  const totals = recalculateInvoiceTotals({
    hammerPrice: lot.currentBid || lot.startingBid || 0,
    buyerPremiumRate,
    shippingAmount: 0
  });

  try {
    return await prisma.invoice.create({
      data: {
        number: invoiceNumber(lot),
        lotId: lot.id,
        auctionId: auction.id,
        auctionHouseId: house.id,
        buyerId: lot.highestBidderId,
        status: 'UNPAID',
        currency: 'usd',
        hammerPrice: totals.hammerPrice,
        buyerPremiumRate: totals.buyerPremiumRate,
        buyerPremiumAmount: totals.buyerPremiumAmount,
        shippingAmount: totals.shippingAmount,
        totalAmount: totals.totalAmount,
        buyerPaysShipping
      }
    });
  } catch (err) {
    // Concurrent close / unique lotId race — return the winner.
    if (err?.code === 'P2002') {
      const raced = await prisma.invoice.findUnique({ where: { lotId } });
      if (raced) return raced;
    }
    throw err;
  }
}

export async function markInvoicePaid(invoiceId, {
  paymentChannel,
  externalPaymentMethod = null,
  stripeCheckoutSessionId = null,
  stripePaymentIntentId = null
} = {}) {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paymentChannel,
      externalPaymentMethod,
      stripeCheckoutSessionId: stripeCheckoutSessionId || undefined,
      stripePaymentIntentId: stripePaymentIntentId || undefined,
      paidAt: new Date()
    }
  });
}

export function publicInvoice(invoice) {
  if (!invoice) return null;
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    hammerPrice: Number(invoice.hammerPrice),
    buyerPremiumRate: Number(invoice.buyerPremiumRate),
    buyerPremiumAmount: Number(invoice.buyerPremiumAmount),
    shippingAmount: Number(invoice.shippingAmount),
    totalAmount: Number(invoice.totalAmount),
    buyerPaysShipping: Boolean(invoice.buyerPaysShipping),
    paymentChannel: invoice.paymentChannel,
    externalPaymentMethod: invoice.externalPaymentMethod,
    paidAt: invoice.paidAt,
    createdAt: invoice.createdAt,
    lot: invoice.lot
      ? {
          id: invoice.lot.id,
          lotNumber: invoice.lot.lotNumber,
          title: invoice.lot.title,
          status: invoice.lot.status
        }
      : undefined,
    auction: invoice.auction
      ? { id: invoice.auction.id, title: invoice.auction.title }
      : undefined,
    auctionHouse: invoice.auctionHouse
      ? { id: invoice.auctionHouse.id, name: invoice.auctionHouse.name }
      : undefined,
    shipment: invoice.shipment
      ? {
          id: invoice.shipment.id,
          status: invoice.shipment.status,
          carrier: invoice.shipment.carrier,
          serviceLevel: invoice.shipment.serviceLevel,
          trackingNumber: invoice.shipment.trackingNumber,
          trackingUrl: invoice.shipment.trackingUrl,
          labelUrl: invoice.shipment.labelUrl,
          shippingAmount: invoice.shipment.shippingAmount
            ? Number(invoice.shipment.shippingAmount)
            : null,
          trackingStatusDetail: invoice.shipment.trackingStatusDetail,
          deliveredAt: invoice.shipment.deliveredAt
        }
      : null
  };
}
