<script>
  let { data } = $props();
  const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value));
</script>

<svelte:head><title>Lots | Pumbi Admin</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-6">
  <header class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Catalog inventory</p><h1 class="mt-1 text-3xl font-black">Lots</h1><p class="mt-1 text-sm text-slate-500">Inspect catalog readiness, bidding activity, and auction placement.</p></div><span class="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">{data.total} lots</span></header>

  <form class="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto]">
    <input name="q" value={data.filters.search} class="rounded-lg border-slate-300 text-sm" placeholder="Search lot or auction" aria-label="Search lots" />
    <select name="status" value={data.filters.status} class="rounded-lg border-slate-300 text-sm" aria-label="Filter by status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SOLD">Sold</option><option value="UNSOLD">Unsold</option><option value="WITHDRAWN">Withdrawn</option></select>
    <button class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filter</button>
  </form>

  <section class="overflow-hidden rounded-2xl border bg-white shadow-sm"><div class="overflow-x-auto"><table class="w-full min-w-[900px] text-left text-sm">
    <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-5 py-3">Lot</th><th class="px-5 py-3">Auction</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Pricing</th><th class="px-5 py-3">Assets</th><th class="px-5 py-3"></th></tr></thead>
    <tbody class="divide-y divide-slate-100">
      {#each data.lots as lot}
        <tr class="hover:bg-slate-50">
          <td class="px-5 py-4"><div class="font-semibold text-slate-950">#{lot.lotNumber} · {lot.title}</div><div class="text-xs {lot.isReady ? 'text-emerald-700' : 'text-amber-700'}">{lot.isReady ? 'Ready for marketplace' : 'Needs catalog review'}</div></td>
          <td class="px-5 py-4"><a href={`/auctions/${lot.auction.id}`} class="font-medium hover:text-indigo-600">{lot.auction.title}</a><div class="text-xs text-slate-500">{lot.auction.auctionHouse.name} · {lot.auction.type}</div></td>
          <td class="px-5 py-4"><span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{lot.status}</span></td>
          <td class="px-5 py-4 text-slate-600">{money(lot.currentBid)}<div class="text-xs text-slate-400">starts {money(lot.startingBid)}</div></td>
          <td class="px-5 py-4 text-slate-600">{lot._count.images} images · {lot._count.bids} bids</td>
          <td class="px-5 py-4 text-right"><a href={`/lots/${lot.id}`} class="text-sm font-semibold text-indigo-600">View →</a></td>
        </tr>
      {/each}
      {#if data.lots.length === 0}<tr><td colspan="6" class="px-5 py-12 text-center text-slate-500">No lots match these filters.</td></tr>{/if}
    </tbody>
  </table></div></section>
</div>
