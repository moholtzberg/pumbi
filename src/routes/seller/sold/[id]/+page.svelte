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

<main class="min-h-screen bg-slate-50">
  <div class="mx-auto max-w-3xl px-4 py-8">
    <a href="/seller/sold" class="text-sm font-semibold text-slate-600">← Sold lots</a>
    <h1 class="mt-3 text-3xl font-black text-slate-900">{invoice.number}</h1>
    <p class="mt-1 text-slate-600">Lot #{invoice.lot?.lotNumber} · {invoice.lot?.title}</p>
    <p class="text-sm text-slate-500">{invoice.buyer?.name || invoice.buyer?.email} · {money(invoice.totalAmount)} · {invoice.status}</p>

    {#if errorMessage}<div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>{/if}
    {#if notice}<div class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>{/if}

    <section class="mt-6 rounded-xl border bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold">Payment</h2>
      <div class="mt-3 space-y-1 text-sm">
        <p>Hammer {money(invoice.hammerPrice)} · Premium {money(invoice.buyerPremiumAmount)} · Shipping {money(invoice.shippingAmount)}</p>
        <p class="font-semibold">Total {money(invoice.totalAmount)}</p>
      </div>
      {#if invoice.status !== 'PAID'}
        <button type="button" class="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={Boolean(busy)} onclick={markPaid}>
          {busy === 'mark_paid' ? 'Saving…' : 'Mark paid'}
        </button>
      {/if}
    </section>

    <section class="mt-6 rounded-xl border bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold">Shipping tools</h2>
      <p class="mt-1 text-sm text-slate-600">
        {invoice.buyerPaysShipping
          ? 'Buyer chooses the rate at checkout. After payment, the label appears here for printing.'
          : 'Enter the buyer address, pick a rate, then purchase a label after payment.'}
      </p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <label class="text-sm sm:col-span-2">Name<input class="mt-1 w-full rounded-lg border px-3 py-2" bind:value={address.name} /></label>
        <label class="text-sm sm:col-span-2">Street<input class="mt-1 w-full rounded-lg border px-3 py-2" bind:value={address.street1} /></label>
        <label class="text-sm">City<input class="mt-1 w-full rounded-lg border px-3 py-2" bind:value={address.city} /></label>
        <label class="text-sm">State<input class="mt-1 w-full rounded-lg border px-3 py-2" bind:value={address.state} /></label>
        <label class="text-sm">ZIP<input class="mt-1 w-full rounded-lg border px-3 py-2" bind:value={address.zip} /></label>
        <label class="text-sm">Country<input class="mt-1 w-full rounded-lg border px-3 py-2" bind:value={address.country} /></label>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={Boolean(busy)} onclick={getRates}>
          {busy === 'quote_shipping' ? 'Loading…' : 'Get rates'}
        </button>
        {#if invoice.status === 'PAID' && (selectedRateId || invoice.shipment?.carrier)}
          <button type="button" class="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={Boolean(busy)} onclick={buyLabel}>
            {busy === 'purchase_label' ? 'Purchasing…' : 'Purchase label'}
          </button>
        {/if}
        {#if invoice.shipment?.labelUrl}
          <a href={invoice.shipment.labelUrl} target="_blank" rel="noreferrer" class="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white">Print label</a>
        {/if}
      </div>

      {#if rates.length}
        <div class="mt-4 divide-y rounded-lg border">
          {#each rates as rate}
            <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 {selectedRateId === rate.objectId ? 'bg-violet-50' : ''}" onclick={() => chooseRate(rate.objectId)}>
              <span class="font-semibold">{rate.provider} · {rate.servicelevel}</span>
              <span>{money(rate.amount)}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if invoice.shipment?.trackingNumber}
        <p class="mt-4 text-sm">
          Tracking:
          <a class="font-semibold text-violet-700 underline" href={invoice.shipment.trackingUrl || '#'} target="_blank" rel="noreferrer">{invoice.shipment.trackingNumber}</a>
          · {invoice.shipment.status}
          {#if invoice.shipment.trackingStatusDetail}<span class="text-slate-500"> — {invoice.shipment.trackingStatusDetail}</span>{/if}
        </p>
      {/if}
    </section>
  </div>
</main>
