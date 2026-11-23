<script>
  import { onMount } from 'svelte';
  let { auctionHouseId } = $props();
  let metrics = $state(null);
  let errorMessage = $state('');
  let loading = $state(false);
  let mounted = $state(false);
  let requestVersion = 0;
  const money = (value, currency = 'USD') => value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  async function load() {
    if (!auctionHouseId) return;
    const version = ++requestVersion;
    loading = true;
    errorMessage = '';
    try {
      const response = await fetch(`/api/seller/analytics?auctionHouseId=${encodeURIComponent(auctionHouseId)}`);
      if (!response.ok) throw new Error('Unable to load seller analytics');
      const result = await response.json();
      if (version === requestVersion) metrics = result;
    } catch (err) { if (version === requestVersion) errorMessage = err.message; }
    finally { if (version === requestVersion) loading = false; }
  }
  $effect(() => { auctionHouseId; if (mounted) { metrics = null; load(); } });
  onMount(() => { mounted = true; return () => { ++requestVersion; }; });
</script>

<section class="mt-7" aria-label="Seller analytics">
  <div class="mb-4 flex items-center justify-between gap-3">
    <div><p class="pumbi-eyebrow">Performance · all time</p><h2 class="mt-1 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">Sales & collections</h2></div>
    <button type="button" class="pumbi-btn-secondary" disabled={loading} onclick={load}>{loading ? 'Refreshing…' : 'Refresh analytics'}</button>
  </div>
  {#if errorMessage}<p role="status" class="mb-3 text-sm text-amber-800">{errorMessage}{metrics ? ' · Showing the last successful update.' : ''}</p>{/if}
  {#if metrics}
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {#each [
        ['Lots sold', metrics.sales.sold, `${metrics.sales.totalLots} lots cataloged`],
        ['Sell-through rate', metrics.sales.sellThrough == null ? '—' : `${metrics.sales.sellThrough.toFixed(1)}%`, 'Sold ÷ sold and unsold lots'],
        ['Auctions', metrics.auctions.total, `${metrics.auctions.live} live now`],
        ['Lots unsold', metrics.sales.unsold, 'Active and withdrawn lots excluded']
      ] as [label, value, detail]}
        <div class="pumbi-panel p-4"><p class="text-xs text-[var(--pumbi-muted)]">{label}</p><p class="mt-2 text-3xl font-semibold tabular-nums">{value}</p><p class="mt-2 text-xs text-[var(--pumbi-muted)]">{detail}</p></div>
      {/each}
    </div>
    {#if metrics.canViewFinance}
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div class="pumbi-panel p-4"><p class="text-xs text-[var(--pumbi-muted)]">Total sold · hammer value (USD)</p><p class="mt-2 text-3xl font-semibold">{money(metrics.sales.hammerTotal)}</p><p class="mt-2 text-xs text-[var(--pumbi-muted)]">Before buyer premiums and shipping</p></div>
        <div class="pumbi-panel p-4"><p class="text-xs text-[var(--pumbi-muted)]">Average sold lot (USD)</p><p class="mt-2 text-3xl font-semibold">{money(metrics.sales.averageHammer)}</p><p class="mt-2 text-xs text-[var(--pumbi-muted)]">Hammer value ÷ lots sold</p></div>
      </div>
      {#each metrics.collections as collection}
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          {#each [
            [`Payments received · ${collection.currency}`, money(collection.received, collection.currency), `${collection.paidInvoices} paid invoices`],
            [`Outstanding · ${collection.currency}`, money(collection.outstanding, collection.currency), `${collection.unpaidInvoices} unpaid invoices`],
            [`Average payment · ${collection.currency}`, money(collection.averagePayment, collection.currency), 'Received ÷ paid invoices']
          ] as [label, value, detail]}
            <div class="pumbi-panel p-4"><p class="text-xs text-[var(--pumbi-muted)]">{label}</p><p class="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p class="mt-2 text-xs text-[var(--pumbi-muted)]">{detail}</p></div>
          {/each}
        </div>
      {/each}
      {#if !metrics.collections.length}<p class="pumbi-panel mt-3 p-4 text-sm text-[var(--pumbi-muted)]">No invoices yet. Payment analytics will appear when sold lots are invoiced.</p>{/if}
      {#if metrics.methods.length}
        <div class="pumbi-panel mt-3 overflow-x-auto p-4">
          <h3 class="mb-3 font-semibold">Payments received by method</h3>
          <table class="w-full text-left text-sm"><thead class="text-xs text-[var(--pumbi-muted)]"><tr><th class="pb-2">Method</th><th class="pb-2 text-right">Invoices</th><th class="pb-2 text-right">Received</th></tr></thead>
            <tbody>{#each metrics.methods as method}<tr class="border-t border-[var(--pumbi-line-soft)]"><td class="py-2">{method.method} · {method.currency}</td><td class="py-2 text-right tabular-nums">{method.count}</td><td class="py-2 text-right tabular-nums">{money(method.amount, method.currency)}</td></tr>{/each}</tbody>
          </table>
        </div>
      {/if}
      <p class="mt-3 text-xs text-[var(--pumbi-muted)]">Received payments include invoice premiums and shipping, and exclude refunded or canceled invoices. These are invoice collections, not bank payouts. Currencies are reported separately.</p>
    {:else}<p class="mt-3 text-xs text-[var(--pumbi-muted)]">Payment totals and sale values are visible to house owners, administrators, and finance members.</p>{/if}
  {:else if loading}<p class="pumbi-panel p-5 text-sm text-[var(--pumbi-muted)]">Loading seller analytics…</p>{/if}
</section>
