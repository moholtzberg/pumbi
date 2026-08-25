<script>
  let { data } = $props();

  let busy = $state('');
  let errorMessage = $state('');
  let successMessage = $state(
    data.paidFlag ? 'Payment received — thank you.' : data.canceledFlag ? 'Checkout canceled.' : ''
  );
  let invoice = $state(data.invoice);
  let rates = $state(data.rates || []);
  let selectedRateId = $state(data.selectedRateId || '');
  let address = $state({ ...data.shippingAddress });

  function money(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (invoice.currency || 'usd').toUpperCase()
    }).format(Number(amount || 0));
  }

  async function api(action, payload = {}) {
    busy = action;
    errorMessage = '';
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...payload })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `Failed to ${action}`);
      return body;
    } catch (err) {
      errorMessage = err.message || 'Something went wrong';
      throw err;
    } finally {
      busy = '';
    }
  }

  async function getRates() {
    try {
      const result = await api('quote_shipping', { address });
      rates = result.rates || [];
      selectedRateId = '';
      successMessage = rates.length ? 'Shipping options loaded.' : 'No rates returned.';
    } catch {
      /* shown via errorMessage */
    }
  }

  async function chooseRate(rateId) {
    try {
      const result = await api('select_shipping', { rateId });
      selectedRateId = rateId;
      invoice = result.invoice;
      successMessage = 'Shipping option selected.';
    } catch {
      /* shown */
    }
  }

  async function payPumbi() {
    try {
      const result = await api('pay_pumbi');
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      throw new Error('Checkout URL missing');
    } catch {
      /* shown */
    }
  }

  async function payExternal(method) {
    try {
      const result = await api('pay_external', { method });
      invoice = result.invoice;
      successMessage = `Marked as paying by ${method}. The seller will confirm when payment arrives.`;
    } catch {
      /* shown */
    }
  }

  let unpaid = $derived(['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'].includes(invoice.status));
</script>

<main class="min-h-screen bg-[#f7f4ee]">
  <div class="mx-auto max-w-3xl px-4 py-8">
    <a href="/dashboard#won-lots" class="text-sm font-semibold text-[#18372f]">← Back to dashboard</a>
    <header class="mt-4">
      <p class="text-xs font-bold uppercase tracking-[0.16em] text-[#a95739]">Invoice {invoice.number}</p>
      <h1 class="mt-1 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold text-[#1a2821]">
        Lot #{invoice.lot?.lotNumber} · {invoice.lot?.title}
      </h1>
      <p class="mt-1 text-sm text-[#435048]">
        {invoice.auctionHouse?.name || 'Seller'} · {invoice.auction?.title}
      </p>
    </header>

    {#if errorMessage}
      <div class="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
    {/if}
    {#if successMessage}
      <div class="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div>
    {/if}

    <section class="mt-6 grid gap-4 border border-[#ddd6ca] bg-white p-5 sm:grid-cols-[96px_1fr]">
      <div class="h-24 overflow-hidden border border-[#ddd6ca] bg-[#efe8dc]">
        {#if invoice.lot?.imageUrl}
          <img src={invoice.lot.imageUrl} alt="" class="h-full w-full object-cover" />
        {/if}
      </div>
      <div class="space-y-1 text-sm">
        <div class="flex justify-between gap-4"><span class="text-[#435048]">Hammer</span><strong>{money(invoice.hammerPrice)}</strong></div>
        <div class="flex justify-between gap-4"><span class="text-[#435048]">Buyer’s premium ({invoice.buyerPremiumRate}%)</span><strong>{money(invoice.buyerPremiumAmount)}</strong></div>
        <div class="flex justify-between gap-4"><span class="text-[#435048]">Shipping</span><strong>{money(invoice.shippingAmount)}</strong></div>
        <div class="flex justify-between gap-4 border-t border-[#e2dcd1] pt-2 text-base"><span class="font-semibold">Total</span><strong>{money(invoice.totalAmount)}</strong></div>
        <p class="pt-2 text-xs font-bold uppercase tracking-wide text-[#18372f]">Status · {invoice.status.replaceAll('_', ' ')}</p>
      </div>
    </section>

    {#if unpaid && invoice.buyerPaysShipping}
      <section class="mt-6 border border-[#ddd6ca] bg-white p-5">
        <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Shipping address</h2>
        <p class="mt-1 text-sm text-[#435048]">Buyer pays shipping — choose a rate before checkout. The label is created for the seller automatically after payment.</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-sm sm:col-span-2">Name<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.name} /></label>
          <label class="text-sm sm:col-span-2">Street<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.street1} /></label>
          <label class="text-sm sm:col-span-2">Street 2<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.street2} /></label>
          <label class="text-sm">City<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.city} /></label>
          <label class="text-sm">State<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.state} /></label>
          <label class="text-sm">ZIP<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.zip} /></label>
          <label class="text-sm">Country<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.country} /></label>
        </div>
        <button
          type="button"
          class="mt-4 bg-[#18372f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          disabled={Boolean(busy)}
          onclick={getRates}
        >
          {busy === 'quote_shipping' ? 'Getting rates…' : 'Get shipping rates'}
        </button>

        {#if rates.length}
          <div class="mt-4 divide-y divide-[#e2dcd1] border border-[#ddd6ca]">
            {#each rates as rate}
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#f7f4ee] {selectedRateId === rate.objectId ? 'bg-[#e8eee9]' : ''}"
                disabled={Boolean(busy)}
                onclick={() => chooseRate(rate.objectId)}
              >
                <div>
                  <p class="font-semibold text-[#1a2821]">{rate.provider} · {rate.servicelevel}</p>
                  <p class="text-xs text-[#435048]">{rate.durationTerms || (rate.estimatedDays ? `${rate.estimatedDays} days` : 'Transit time varies')}</p>
                </div>
                <p class="font-bold">{money(rate.amount)}</p>
              </button>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if unpaid}
      <section class="mt-6 border border-[#ddd6ca] bg-white p-5">
        <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Pay</h2>
        <p class="mt-1 text-sm text-[#435048]">Pay with Pumbi (Stripe Checkout) is always available. Other options come from the seller’s settings.</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="bg-[#a95739] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            disabled={Boolean(busy)}
            onclick={payPumbi}
          >
            {busy === 'pay_pumbi' ? 'Starting checkout…' : 'Pay with Pumbi'}
          </button>
          {#each data.paymentMethods.filter((m) => m.channel === 'EXTERNAL') as method}
            <button
              type="button"
              class="border border-[#18372f] px-4 py-2.5 text-sm font-bold text-[#18372f] disabled:opacity-50"
              disabled={Boolean(busy)}
              onclick={() => payExternal(method.method)}
            >
              Pay by {method.label}
            </button>
          {/each}
        </div>
      </section>
    {:else if invoice.status === 'PAID'}
      <section class="mt-6 border border-[#ddd6ca] bg-white p-5">
        <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Paid</h2>
        <p class="mt-1 text-sm text-[#435048]">
          Paid {invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : ''}
          {#if invoice.paymentChannel === 'PUMBI_STRIPE'} via Pumbi{/if}
          {#if invoice.externalPaymentMethod} · {invoice.externalPaymentMethod}{/if}
        </p>
        {#if invoice.shipment?.trackingNumber}
          <p class="mt-3 text-sm">
            Tracking: <a class="font-semibold text-[#18372f] underline" href={invoice.shipment.trackingUrl || '#'} target="_blank" rel="noreferrer">{invoice.shipment.trackingNumber}</a>
            · {invoice.shipment.status.replaceAll('_', ' ')}
          </p>
        {/if}
      </section>
    {/if}
  </div>
</main>
