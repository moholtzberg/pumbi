<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import RecordPayment from '$lib/components/RecordPayment.svelte';
  import SendInvoice from '$lib/components/SendInvoice.svelte';
  let { data } = $props();
  let busyId = $state('');
  let notice = $state('');
  let errorMessage = $state('');
  let invoices = $state(data.invoices || []);

  $effect(() => {
    invoices = data.invoices || [];
  });

  function money(amount, currency = 'usd') {
    return new Intl.NumberFormat(uiLocale(), { style: 'currency', currency: currency.toUpperCase() }).format(Number(amount || 0));
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
      if (!response.ok) throw new Error(body.message || ui("Failed to {value0}", { value0: action }));
      notice = action === 'purchase_label' ? ui("Shipping label ready") : ui("Updated");
      window.location.reload();
    } catch (err) {
      errorMessage = err.message || ui("Request failed");
    } finally {
      busyId = '';
    }
  }
</script>

<main class="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="pumbi-eyebrow">{ui("Fulfillment")}</p>
      <h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{ui("Sold & shipping")}</h1>
      <p class="mt-2 text-sm text-[var(--pumbi-ink-soft)]">{ui("Payment status, labels, and tracking for hammered lots.")}</p>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each [['all', 'All'], ['UNPAID', 'Unpaid'], ['AWAITING_EXTERNAL', 'Awaiting'], ['PAID', 'Paid']] as [value, label]}
        <a
          href={`/seller/sold?status=${value}`}
          class="px-3 py-2 text-xs font-bold uppercase tracking-wide {data.statusFilter === value
            ? 'bg-[var(--pumbi-forest)] text-white'
            : 'pumbi-btn-secondary'}"
        >{ui(label)}</a>
      {/each}
    </div>
  </div>

  {#if errorMessage}
    <div class="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{ui(errorMessage)}</div>
  {/if}
  {#if notice}
    <div class="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{ui(notice)}</div>
  {/if}

  <div class="pumbi-panel mt-6 overflow-hidden">
    {#if invoices.length === 0}
      <p class="p-10 text-center text-[var(--pumbi-muted)]">{ui("No sold-lot invoices yet. Hammer a lot in the control room to generate one.")}</p>
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
              <p class="mt-1 truncate font-semibold text-[var(--pumbi-ink)]">{ui("Lot #")}{invoice.lot.lotNumber} · {invoice.lot.title}</p>
              <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">
                {ui("Buyer:")} {invoice.buyer?.name || invoice.buyer?.email || '—'} {ui("· Total")} {money(invoice.totalAmount, invoice.currency)}
              </p>
            </div>
            <div class="text-sm text-[var(--pumbi-ink-soft)]">
              <p><span class="font-semibold text-[var(--pumbi-ink)]">{ui("Payment:")}</span> {uiStatus(invoice.status.replaceAll('_', ' '))}</p>
              {#if invoice.paymentChannel}<p class="mt-1 text-xs">{invoice.paymentChannel === 'PUMBI_STRIPE' ? ui("Credit card · Stripe") : invoice.externalPaymentMethod}</p>{/if}
              {#if invoice.shipment}
                <p class="mt-2"><span class="font-semibold text-[var(--pumbi-ink)]">{ui("Shipment:")}</span> {uiStatus(invoice.shipment.status.replaceAll('_', ' '))}</p>
                {#if invoice.shipment.trackingNumber}
                  <a class="mt-1 inline-block font-semibold text-[var(--pumbi-forest)] underline" href={invoice.shipment.trackingUrl || '#'} target="_blank" rel="noreferrer">
                    {invoice.shipment.carrier || ui("Carrier")} {invoice.shipment.trackingNumber}
                  </a>
                {/if}
              {:else}
                <p class="mt-2 text-[var(--pumbi-muted)]">{ui("No shipment yet")}</p>
              {/if}
            </div>
            <div class="flex flex-col gap-2">
              <SendInvoice {invoice} disabled={Boolean(busyId)} />
              <RecordPayment {invoice} disabled={Boolean(busyId)} />
              {#if invoice.shipment?.labelUrl}
                <a href={invoice.shipment.labelUrl} target="_blank" rel="noreferrer" class="pumbi-btn-secondary text-center">{ui("Print label")}</a>
              {:else if invoice.status === 'PAID' && invoice.shipment?.carrier}
                <button
                  type="button"
                  class="pumbi-btn-secondary"
                  disabled={Boolean(busyId)}
                  onclick={() => run(invoice.id, 'purchase_label')}
                >
                  {busyId === `${invoice.id}:purchase_label` ? ui("Creating…") : ui("Create label")}
                </button>
              {/if}
              <a href={`/seller/sold/${invoice.id}`} class="text-center text-xs font-semibold text-[var(--pumbi-forest)] underline">{ui("Shipping tools")}</a>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</main>
