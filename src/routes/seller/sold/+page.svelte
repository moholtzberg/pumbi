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
      window.location.reload();
    } catch (err) {
      errorMessage = err.message || 'Request failed';
    } finally {
      busyId = '';
    }
  }
</script>

<main class="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="pumbi-eyebrow">Fulfillment</p>
      <h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">Sold & shipping</h1>
      <p class="mt-2 text-sm text-[var(--pumbi-ink-soft)]">Payment status, labels, and tracking for hammered lots.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each [['all', 'All'], ['UNPAID', 'Unpaid'], ['AWAITING_EXTERNAL', 'Awaiting'], ['PAID', 'Paid']] as [value, label]}
        <a
          href={`/seller/sold?status=${value}`}
          class="px-3 py-2 text-xs font-bold uppercase tracking-wide {data.statusFilter === value
            ? 'bg-[var(--pumbi-forest)] text-white'
            : 'pumbi-btn-secondary'}"
        >{label}</a>
      {/each}
    </div>
  </div>

  {#if errorMessage}
    <div class="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
  {/if}
  {#if notice}
    <div class="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
  {/if}

  <div class="pumbi-panel mt-6 overflow-hidden">
    {#if invoices.length === 0}
      <p class="p-10 text-center text-[var(--pumbi-muted)]">No sold-lot invoices yet. Hammer a lot in the control room to generate one.</p>
    {:else}
      <div class="divide-y divide-[var(--pumbi-line-soft)]">
        {#each invoices as invoice}
          <article class="grid gap-4 p-4 lg:grid-cols-[72px_minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
            <div class="h-[72px] w-[72px] overflow-hidden bg-[var(--pumbi-cream-deep)]">
              {#if invoice.lot.imageUrl}
                <img src={invoice.lot.imageUrl} alt="" class="h-full w-full object-cover" />
              {/if}
            </div>
            <div class="min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-wide text-[var(--pumbi-muted)]">{invoice.number} · {invoice.auction.title}</p>
              <p class="mt-1 truncate font-semibold text-[var(--pumbi-ink)]">Lot #{invoice.lot.lotNumber} · {invoice.lot.title}</p>
              <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">
                Buyer: {invoice.buyer?.name || invoice.buyer?.email || '—'} · Total {money(invoice.totalAmount)}
              </p>
            </div>
            <div class="text-sm text-[var(--pumbi-ink-soft)]">
              <p><span class="font-semibold text-[var(--pumbi-ink)]">Payment:</span> {invoice.status.replaceAll('_', ' ')}</p>
              {#if invoice.shipment}
                <p class="mt-2"><span class="font-semibold text-[var(--pumbi-ink)]">Shipment:</span> {invoice.shipment.status.replaceAll('_', ' ')}</p>
                {#if invoice.shipment.trackingNumber}
                  <a class="mt-1 inline-block font-semibold text-[var(--pumbi-forest)] underline" href={invoice.shipment.trackingUrl || '#'} target="_blank" rel="noreferrer">
                    {invoice.shipment.carrier || 'Carrier'} {invoice.shipment.trackingNumber}
                  </a>
                {/if}
              {:else}
                <p class="mt-2 text-[var(--pumbi-muted)]">No shipment yet</p>
              {/if}
            </div>
            <div class="flex flex-col gap-2">
              {#if invoice.status !== 'PAID'}
                <button
                  type="button"
                  class="pumbi-btn"
                  disabled={Boolean(busyId)}
                  onclick={() => run(invoice.id, 'mark_paid')}
                >
                  {busyId === `${invoice.id}:mark_paid` ? 'Saving…' : 'Mark paid'}
                </button>
              {/if}
              {#if invoice.shipment?.labelUrl}
                <a href={invoice.shipment.labelUrl} target="_blank" rel="noreferrer" class="pumbi-btn-secondary text-center">Print label</a>
              {:else if invoice.status === 'PAID' && invoice.shipment?.carrier}
                <button
                  type="button"
                  class="pumbi-btn-secondary"
                  disabled={Boolean(busyId)}
                  onclick={() => run(invoice.id, 'purchase_label')}
                >
                  {busyId === `${invoice.id}:purchase_label` ? 'Creating…' : 'Create label'}
                </button>
              {/if}
              <a href={`/seller/sold/${invoice.id}`} class="text-center text-xs font-semibold text-[var(--pumbi-forest)] underline">Shipping tools</a>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</main>
