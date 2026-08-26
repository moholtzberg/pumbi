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

<section class="grid gap-4 sm:grid-cols-3">
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">Auction page views</p>
    <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{data.auction.viewCount}</p>
    <p class="mt-1 text-sm text-[var(--pumbi-muted)]">{data.auction.uniqueVisitorCount} unique visitors</p>
  </div>
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">Avg time on auction page</p>
    <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{formatDuration(data.auction.avgDwellMs)}</p>
    <p class="mt-1 text-sm text-[var(--pumbi-muted)]">Across all views</p>
  </div>
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">Total attention</p>
    <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{formatDuration(data.auction.totalDwellMs)}</p>
    <p class="mt-1 text-sm text-[var(--pumbi-muted)]">Sum of time on auction page</p>
  </div>
</section>

<section class="pumbi-panel mt-6 overflow-hidden">
  <div class="border-b border-[var(--pumbi-line)] px-5 py-4">
    <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Lots by interest</h2>
    <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">Sorted by unique visitors, then total views.</p>
  </div>
  {#if data.lots.length === 0}
    <p class="p-8 text-center text-[var(--pumbi-muted)]">No lots in this auction yet.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-[var(--pumbi-cream)] text-left text-[10px] font-bold uppercase tracking-wide text-[var(--pumbi-muted)]">
          <tr>
            <th class="px-5 py-3">Lot</th>
            <th class="px-5 py-3">Status</th>
            <th class="px-5 py-3 text-right">Views</th>
            <th class="px-5 py-3 text-right">Unique</th>
            <th class="px-5 py-3 text-right">Avg time</th>
            <th class="px-5 py-3 text-right">Total time</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--pumbi-line-soft)]">
          {#each data.lots as lot}
            <tr class="hover:bg-[var(--pumbi-cream)]/70">
              <td class="px-5 py-3">
                <a href={`/lots/${lot.id}`} class="font-semibold text-[var(--pumbi-ink)] hover:text-[var(--pumbi-terracotta)]" target="_blank" rel="noreferrer">
                  #{lot.lotNumber} · {lot.title}
                </a>
              </td>
              <td class="px-5 py-3 text-[var(--pumbi-muted)]">{lot.status}</td>
              <td class="px-5 py-3 text-right font-semibold tabular-nums">{lot.viewCount}</td>
              <td class="px-5 py-3 text-right font-semibold tabular-nums">{lot.uniqueVisitorCount}</td>
              <td class="px-5 py-3 text-right tabular-nums text-[var(--pumbi-ink-soft)]">{formatDuration(lot.avgDwellMs)}</td>
              <td class="px-5 py-3 text-right tabular-nums text-[var(--pumbi-ink-soft)]">{formatDuration(lot.totalDwellMs)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
