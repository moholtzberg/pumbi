<script>
  let { data } = $props();
  let busyId = $state('');
  let notice = $state('');
  let errorMessage = $state('');
  let invoices = $state(data.invoices || []);

  $effect(() => {
    invoices = data.invoices || [];
  });

  function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));
  }

  async function run(invoiceId, action, payload = {}) {
    busyId = `${invoiceId}:${action}`;
    errorMessage = '';
    notice = '';
    try {
      const response = await fetch(`/api/seller/invoices/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...payload })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `Failed to ${action}`);
      notice =
        action === 'mark_paid'
          ? 'Invoice marked paid'
          : action === 'purchase_label'
            ? 'Shipping label ready'
            : 'Updated';
      // Refresh list
      window.location.reload();
    } catch (err) {
      errorMessage = err.message || 'Request failed';
    } finally {
      busyId = '';
    }
  }
</script>

<main class="min-h-screen bg-slate-50">
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Seller operations</p>
        <h1 class="mt-1 text-3xl font-black text-slate-900">Sold lots & shipping</h1>
        <p class="mt-1 text-sm text-slate-600">Payment status, labels, and tracking for hammered lots.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        {#each [['all', 'All'], ['UNPAID', 'Unpaid'], ['AWAITING_EXTERNAL', 'Awaiting'], ['PAID', 'Paid']] as [value, label]}
          <a
            href={`/seller/sold?status=${value}`}
            class="rounded-lg px-3 py-2 text-sm font-bold {data.statusFilter === value ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700'}"
          >{label}</a>
        {/each}
        <a href="/seller" class="rounded-lg border bg-white px-3 py-2 text-sm font-bold text-slate-700">Seller home</a>
      </div>
    </div>

    {#if errorMessage}
      <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
    {/if}
    {#if notice}
      <div class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
    {/if}

    <div class="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
      {#if invoices.length === 0}
        <p class="p-10 text-center text-slate-500">No sold-lot invoices yet. Hammer a lot in the control room to generate one.</p>
      {:else}
        <div class="divide-y">
          {#each invoices as invoice}
            <article class="grid gap-4 p-4 lg:grid-cols-[72px_minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
              <div class="h-[72px] w-[72px] overflow-hidden rounded-lg bg-slate-100">
                {#if invoice.lot.imageUrl}
                  <img src={invoice.lot.imageUrl} alt="" class="h-full w-full object-cover" />
                {/if}
              </div>
              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-400">{invoice.number} · {invoice.auction.title}</p>
                <p class="mt-1 truncate font-bold text-slate-900">Lot #{invoice.lot.lotNumber} · {invoice.lot.title}</p>
                <p class="mt-1 text-sm text-slate-600">
                  Buyer: {invoice.buyer?.name || invoice.buyer?.email || '—'} · Total {money(invoice.totalAmount)}
                </p>
              </div>
              <div class="text-sm text-slate-600">
                <p><span class="font-semibold text-slate-900">Payment:</span> {invoice.status.replaceAll('_', ' ')}</p>
                {#if invoice.paymentChannel}
                  <p class="mt-1">{invoice.paymentChannel === 'PUMBI_STRIPE' ? 'Pumbi / Stripe' : invoice.externalPaymentMethod || 'External'}</p>
                {/if}
                {#if invoice.shipment}
                  <p class="mt-2"><span class="font-semibold text-slate-900">Shipment:</span> {invoice.shipment.status.replaceAll('_', ' ')}</p>
                  {#if invoice.shipment.trackingNumber}
                    <a class="mt-1 inline-block font-semibold text-violet-700 underline" href={invoice.shipment.trackingUrl || '#'} target="_blank" rel="noreferrer">
                      {invoice.shipment.carrier || 'Carrier'} {invoice.shipment.trackingNumber}
                    </a>
                  {/if}
                  {#if invoice.shipment.trackingStatusDetail}
                    <p class="mt-1 text-xs text-slate-500">{invoice.shipment.trackingStatusDetail}</p>
                  {/if}
                {:else}
                  <p class="mt-2 text-slate-400">No shipment yet</p>
                {/if}
              </div>
              <div class="flex flex-col gap-2">
                {#if invoice.status !== 'PAID'}
                  <button
                    type="button"
                    class="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    disabled={Boolean(busyId)}
                    onclick={() => run(invoice.id, 'mark_paid')}
                  >
                    {busyId === `${invoice.id}:mark_paid` ? 'Saving…' : 'Mark paid'}
                  </button>
                {/if}
                {#if invoice.shipment?.labelUrl}
                  <a
                    href={invoice.shipment.labelUrl}
                    target="_blank"
                    rel="noreferrer"
                    class="rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-bold text-white"
                  >Print label</a>
                {:else if invoice.status === 'PAID' && invoice.shipment?.carrier}
                  <button
                    type="button"
                    class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"
                    disabled={Boolean(busyId)}
                    onclick={() => run(invoice.id, 'purchase_label')}
                  >
                    {busyId === `${invoice.id}:purchase_label` ? 'Creating…' : 'Create label'}
                  </button>
                {/if}
                <a href={`/seller/sold/${invoice.id}`} class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-bold text-slate-800">
                  Shipping tools
                </a>
                <a href={`/lots/${invoice.lot.id}`} class="text-center text-xs font-semibold text-slate-500 underline">View lot</a>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</main>
