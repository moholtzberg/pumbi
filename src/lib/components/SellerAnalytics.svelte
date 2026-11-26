<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { onMount } from 'svelte';
  let { auctionHouseId } = $props();
  let metrics = $state(null);
  let errorMessage = $state('');
  let loading = $state(false);
  let mounted = $state(false);
  let requestVersion = 0;
  const money = (value, currency = 'USD') => value == null ? '—' : new Intl.NumberFormat(uiLocale(), { style: 'currency', currency }).format(value);
  async function load() {
    if (!auctionHouseId) return;
    const version = ++requestVersion;
    loading = true;
    errorMessage = '';
    try {
      const response = await fetch(`/api/seller/analytics?auctionHouseId=${encodeURIComponent(auctionHouseId)}`);
      if (!response.ok) throw new Error(ui("Unable to load seller analytics"));
      const result = await response.json();
      if (version === requestVersion) metrics = result;
    } catch (err) { if (version === requestVersion) errorMessage = err.message; }
    finally { if (version === requestVersion) loading = false; }
  }
  $effect(() => { auctionHouseId; if (mounted) { metrics = null; load(); } });
  onMount(() => { mounted = true; return () => { ++requestVersion; }; });
</script>

<section class="mt-7" aria-label={ui("Seller analytics")}>
  <div class="mb-4 flex items-center justify-between gap-3">
    <div><p class="pumbi-eyebrow">{ui("Performance · all time")}</p><h2 class="mt-1 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">{ui("Sales & collections")}</h2></div>
    <button type="button" class="pumbi-btn-secondary" disabled={loading} onclick={load}>{loading ? ui("Refreshing…") : ui("Refresh analytics")}</button>
  </div>
  {#if errorMessage}<p role="status" class="mb-3 text-sm text-amber-800">{ui(errorMessage)}{metrics ? ui(" · Showing the last successful update.") : ''}</p>{/if}
  {#if metrics}
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {#each [
        [ui("Lots sold"), metrics.sales.sold, ui("{value0} lots cataloged", { value0: metrics.sales.totalLots })],
        [ui("Sell-through rate"), metrics.sales.sellThrough == null ? '—' : `${metrics.sales.sellThrough.toFixed(1)}%`, ui("Sold ÷ sold and unsold lots")],
        [ui("Auctions"), metrics.auctions.total, ui("{value0} live now", { value0: metrics.auctions.live })],
        [ui("Lots unsold"), metrics.sales.unsold, ui("Active and withdrawn lots excluded")]
      ] as [label, value, detail]}
        <div class="pumbi-panel p-4"><p class="text-xs text-[var(--pumbi-muted)]">{ui(label)}</p><p class="mt-2 text-3xl font-semibold tabular-nums">{value}</p><p class="mt-2 text-xs text-[var(--pumbi-muted)]">{ui(detail)}</p></div>
      {/each}
    </div>
    {#if metrics.canViewFinance}
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div class="pumbi-panel p-4"><p class="text-xs text-[var(--pumbi-muted)]">{ui("Total sold · hammer value (USD)")}</p><p class="mt-2 text-3xl font-semibold">{money(metrics.sales.hammerTotal)}</p><p class="mt-2 text-xs text-[var(--pumbi-muted)]">{ui("Before buyer premiums and shipping")}</p></div>
        <div class="pumbi-panel p-4"><p class="text-xs text-[var(--pumbi-muted)]">{ui("Average sold lot (USD)")}</p><p class="mt-2 text-3xl font-semibold">{money(metrics.sales.averageHammer)}</p><p class="mt-2 text-xs text-[var(--pumbi-muted)]">{ui("Hammer value ÷ lots sold")}</p></div>
      </div>
      {#each metrics.collections as collection}
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          {#each [
            [ui("Payments received · {value0}", { value0: collection.currency }), money(collection.received, collection.currency), ui("{value0} paid invoices", { value0: collection.paidInvoices })],
            [ui("Outstanding · {value0}", { value0: collection.currency }), money(collection.outstanding, collection.currency), ui("{value0} unpaid invoices", { value0: collection.unpaidInvoices })],
            [ui("Average payment · {value0}", { value0: collection.currency }), money(collection.averagePayment, collection.currency), ui("Received ÷ paid invoices")]
          ] as [label, value, detail]}
            <div class="pumbi-panel p-4"><p class="text-xs text-[var(--pumbi-muted)]">{ui(label)}</p><p class="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p class="mt-2 text-xs text-[var(--pumbi-muted)]">{ui(detail)}</p></div>
          {/each}
        </div>
      {/each}
      {#if !metrics.collections.length}<p class="pumbi-panel mt-3 p-4 text-sm text-[var(--pumbi-muted)]">{ui("No invoices yet. Payment analytics will appear when sold lots are invoiced.")}</p>{/if}
      {#if metrics.methods.length}
        <div class="pumbi-panel mt-3 overflow-x-auto p-4">
          <h3 class="mb-3 font-semibold">{ui("Payments received by method")}</h3>
          <table class="w-full text-start text-sm"><thead class="text-xs text-[var(--pumbi-muted)]"><tr><th class="pb-2">{ui("Method")}</th><th class="pb-2 text-end">{ui("Invoices")}</th><th class="pb-2 text-end">{ui("Received")}</th></tr></thead>
            <tbody>{#each metrics.methods as method}<tr class="border-t border-[var(--pumbi-line-soft)]"><td class="py-2">{method.method} · {method.currency}</td><td class="py-2 text-end tabular-nums">{method.count}</td><td class="py-2 text-end tabular-nums">{money(method.amount, method.currency)}</td></tr>{/each}</tbody>
          </table>
        </div>
      {/if}
      <p class="mt-3 text-xs text-[var(--pumbi-muted)]">{ui("Received payments include invoice premiums and shipping, and exclude refunded or canceled invoices. These are invoice collections, not bank payouts. Currencies are reported separately.")}</p>
    {:else}<p class="mt-3 text-xs text-[var(--pumbi-muted)]">{ui("Payment totals and sale values are visible to house owners, administrators, and finance members.")}</p>{/if}
  {:else if loading}<p class="pumbi-panel p-5 text-sm text-[var(--pumbi-muted)]">{ui("Loading seller analytics…")}</p>{/if}
</section>
