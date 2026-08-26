<script>
  let { data } = $props();

  let invoice = $state(data.invoice);
  let rates = $state(data.rates || []);
  let selectedRateId = $state(data.selectedRateId || '');
  let address = $state({ ...data.address });
  let busy = $state('');
  let errorMessage = $state('');
  let notice = $state('');

  function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));
  }

  async function api(action, payload = {}) {
    busy = action;
    errorMessage = '';
    try {
      const response = await fetch(`/api/seller/invoices/${invoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...payload })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `Failed to ${action}`);
      return body;
    } catch (err) {
      errorMessage = err.message || 'Request failed';
      throw err;
    } finally {
      busy = '';
    }
  }

  async function markPaid() {
    try {
      const result = await api('mark_paid');
      invoice = result.invoice;
      notice = 'Invoice marked paid';
    } catch { /* */ }
  }

  async function getRates() {
    try {
      const result = await api('quote_shipping', { address });
      rates = result.rates || [];
      notice = 'Rates loaded';
    } catch { /* */ }
  }

  async function chooseRate(rateId) {
    try {
      const result = await api('select_shipping', { rateId });
      selectedRateId = rateId;
      invoice = result.invoice;
      notice = 'Rate selected';
    } catch { /* */ }
  }

  async function buyLabel() {
    try {
      const result = await api('purchase_label');
      invoice = {
        ...invoice,
        shipment: {
          ...(invoice.shipment || {}),
          ...result.shipment,
          status: result.shipment.status,
          labelUrl: result.shipment.labelUrl,
          trackingNumber: result.shipment.trackingNumber,
          trackingUrl: result.shipment.trackingUrl
        }
      };
      notice = 'Label purchased — ready to print';
    } catch { /* */ }
  }
</script>

<main class="mx-auto w-full max-w-[820px] px-4 py-8 sm:px-6 lg:px-8">
  <a href="/seller/sold" class="pumbi-link text-sm">← Sold lots</a>
  <header class="mt-3">
    <p class="pumbi-eyebrow">Invoice</p>
    <h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{invoice.number}</h1>
    <p class="mt-1 text-[var(--pumbi-ink-soft)]">Lot #{invoice.lot?.lotNumber} · {invoice.lot?.title}</p>
    <p class="text-sm text-[var(--pumbi-muted)]">{invoice.buyer?.name || invoice.buyer?.email} · {money(invoice.totalAmount)} · {invoice.status}</p>
  </header>

  {#if errorMessage}<div class="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>{/if}
  {#if notice}<div class="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>{/if}

  <section class="pumbi-panel mt-6 p-5">
    <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Payment</h2>
    <div class="mt-3 space-y-1 text-sm">
      <p>Hammer {money(invoice.hammerPrice)} · Premium {money(invoice.buyerPremiumAmount)} · Shipping {money(invoice.shippingAmount)}</p>
      <p class="font-semibold">Total {money(invoice.totalAmount)}</p>
    </div>
    {#if invoice.status !== 'PAID'}
      <button type="button" class="pumbi-btn mt-4" disabled={Boolean(busy)} onclick={markPaid}>
        {busy === 'mark_paid' ? 'Saving…' : 'Mark paid'}
      </button>
    {/if}
  </section>

  <section class="pumbi-panel mt-6 p-5">
    <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Shipping tools</h2>
    <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">
      {invoice.buyerPaysShipping
        ? 'Buyer chooses the rate at checkout. After payment, the label appears here for printing.'
        : 'Enter the buyer address, pick a rate, then purchase a label after payment.'}
    </p>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <label class="text-sm sm:col-span-2">Name<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={address.name} /></label>
      <label class="text-sm sm:col-span-2">Street<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={address.street1} /></label>
      <label class="text-sm">City<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={address.city} /></label>
      <label class="text-sm">State<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={address.state} /></label>
      <label class="text-sm">ZIP<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={address.zip} /></label>
      <label class="text-sm">Country<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={address.country} /></label>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" class="pumbi-btn" disabled={Boolean(busy)} onclick={getRates}>
        {busy === 'quote_shipping' ? 'Loading…' : 'Get rates'}
      </button>
      {#if invoice.status === 'PAID' && (selectedRateId || invoice.shipment?.carrier)}
        <button type="button" class="pumbi-btn-secondary" disabled={Boolean(busy)} onclick={buyLabel}>
          {busy === 'purchase_label' ? 'Purchasing…' : 'Purchase label'}
        </button>
      {/if}
      {#if invoice.shipment?.labelUrl}
        <a href={invoice.shipment.labelUrl} target="_blank" rel="noreferrer" class="pumbi-btn">Print label</a>
      {/if}
    </div>

    {#if rates.length}
      <div class="mt-4 divide-y divide-[var(--pumbi-line-soft)] border border-[var(--pumbi-line)]">
        {#each rates as rate}
          <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--pumbi-cream-deep)] {selectedRateId === rate.objectId ? 'bg-[var(--pumbi-cream-deep)]' : ''}" onclick={() => chooseRate(rate.objectId)}>
            <span class="font-semibold">{rate.provider} · {rate.servicelevel}</span>
            <span>{money(rate.amount)}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if invoice.shipment?.trackingNumber}
      <p class="mt-4 text-sm">
        Tracking:
        <a class="pumbi-link font-semibold" href={invoice.shipment.trackingUrl || '#'} target="_blank" rel="noreferrer">{invoice.shipment.trackingNumber}</a>
        · {invoice.shipment.status}
        {#if invoice.shipment.trackingStatusDetail}<span class="text-[var(--pumbi-muted)]"> — {invoice.shipment.trackingStatusDetail}</span>{/if}
      </p>
    {/if}
  </section>
</main>
