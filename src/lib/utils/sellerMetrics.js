export function summarizeSellerMetrics({ sales, invoices = [], methods = [], canViewFinance = true }) {
  const sold = Number(sales.sold || 0), unsold = Number(sales.unsold || 0);
  const money = value => Math.round(Number(value || 0) * 100) / 100;
  const currencies = new Map();
  for (const row of canViewFinance ? invoices : []) {
    const currency = row.currency.toUpperCase();
    if (!currencies.has(currency)) currencies.set(currency, { currency, received: 0, paidInvoices: 0, outstanding: 0, unpaidInvoices: 0 });
    const entry = currencies.get(currency);
    if (row.status === 'PAID') { entry.received += money(row._sum.totalAmount); entry.paidInvoices += row._count._all; }
    if (['UNPAID', 'PENDING_CHECKOUT', 'AWAITING_EXTERNAL'].includes(row.status)) {
      entry.outstanding += money(row._sum.totalAmount); entry.unpaidInvoices += row._count._all;
    }
  }
  return {
    canViewFinance,
    sales: {
      totalLots: Number(sales.totalLots || 0), sold, unsold,
      sellThrough: sold + unsold > 0 ? sold / (sold + unsold) * 100 : null,
      ...(canViewFinance ? { hammerTotal: money(sales.hammerTotal), averageHammer: sold > 0 ? money(Number(sales.hammerTotal) / sold) : null } : {})
    },
    collections: [...currencies.values()].map(entry => ({
      ...entry, received: money(entry.received), outstanding: money(entry.outstanding),
      averagePayment: entry.paidInvoices ? money(entry.received / entry.paidInvoices) : null
    })).sort((a, b) => a.currency.localeCompare(b.currency)),
    methods: (canViewFinance ? methods : []).map(row => ({
      currency: row.currency.toUpperCase(),
      method: row.paymentChannel === 'PUMBI_STRIPE' ? 'Credit card · Stripe' : row.externalPaymentMethod || 'Other / manual',
      count: row._count._all, amount: money(row._sum.totalAmount)
    }))
  };
}
