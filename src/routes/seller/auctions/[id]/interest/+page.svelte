<script>
  let { data } = $props();

  function formatDuration(ms) {
    const seconds = Math.round(Number(ms || 0) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    if (minutes < 60) return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const minRem = minutes % 60;
    return minRem ? `${hours}h ${minRem}m` : `${hours}h`;
  }
</script>

<div class="min-h-screen bg-slate-100">
  <div class="border-b border-slate-200 bg-white">
    <div class="container mx-auto px-4 py-6">
      <a href={`/seller/auctions/${data.auction.id}`} class="text-sm font-semibold text-blue-700 hover:underline">← Auction hub</a>
      <h1 class="mt-3 text-3xl font-black text-slate-950">Interest & engagement</h1>
      <p class="mt-1 text-sm text-slate-600">{data.auction.title}</p>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8">
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Auction page views</p>
        <p class="mt-2 text-3xl font-black text-slate-950">{data.auction.viewCount}</p>
        <p class="mt-1 text-sm text-slate-500">{data.auction.uniqueVisitorCount} unique visitors</p>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Avg time on auction page</p>
        <p class="mt-2 text-3xl font-black text-slate-950">{formatDuration(data.auction.avgDwellMs)}</p>
        <p class="mt-1 text-sm text-slate-500">Across all views</p>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Total attention</p>
        <p class="mt-2 text-3xl font-black text-slate-950">{formatDuration(data.auction.totalDwellMs)}</p>
        <p class="mt-1 text-sm text-slate-500">Sum of time on auction page</p>
      </div>
    </div>

    <section class="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div class="border-b border-slate-100 px-5 py-4">
        <h2 class="text-lg font-black text-slate-950">Lots by interest</h2>
        <p class="mt-1 text-sm text-slate-500">Sorted by unique visitors, then total views.</p>
      </div>
      {#if data.lots.length === 0}
        <p class="p-8 text-center text-slate-500">No lots in this auction yet.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-5 py-3">Lot</th>
                <th class="px-5 py-3">Status</th>
                <th class="px-5 py-3 text-right">Views</th>
                <th class="px-5 py-3 text-right">Unique</th>
                <th class="px-5 py-3 text-right">Avg time</th>
                <th class="px-5 py-3 text-right">Total time</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each data.lots as lot}
                <tr class="hover:bg-slate-50/80">
                  <td class="px-5 py-3">
                    <a href={`/lots/${lot.id}`} class="font-semibold text-slate-900 hover:text-violet-700" target="_blank" rel="noreferrer">
                      #{lot.lotNumber} · {lot.title}
                    </a>
                  </td>
                  <td class="px-5 py-3 text-slate-500">{lot.status}</td>
                  <td class="px-5 py-3 text-right font-semibold tabular-nums">{lot.viewCount}</td>
                  <td class="px-5 py-3 text-right font-semibold tabular-nums">{lot.uniqueVisitorCount}</td>
                  <td class="px-5 py-3 text-right tabular-nums text-slate-600">{formatDuration(lot.avgDwellMs)}</td>
                  <td class="px-5 py-3 text-right tabular-nums text-slate-600">{formatDuration(lot.totalDwellMs)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </div>
</div>
