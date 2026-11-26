<script>
  import { onMount } from 'svelte';
  import { chartPoints, stepPath } from '$lib/utils/bidChart.js';

  let { auctionId, lotId = null } = $props();
  let activity = $state(null);
  let scope = $state('lot');
  let errorMessage = $state('');
  let selectedIndex = $state(-1);
  let mounted = $state(false);
  let generation = 0;
  let requesting = '';
  let controller;
  const width = 720, height = 240, left = 60, right = 660, top = 20, bottom = 190;
  let selectedLot = $derived(scope === 'lot' ? lotId : null);
  let points = $derived(chartPoints(activity?.history || [], {
    startingBid: activity?.lot?.startingBid || 0,
    now: activity?.updatedAt, finished: activity?.finished
  }));
  let primaryField = $derived(activity?.lot ? 'price' : 'bids');
  let primaryMax = $derived(Math.max(1, ...points.map(point => point[primaryField])));
  let bidderMax = $derived(Math.max(1, ...points.map(point => point.bidders)));
  let start = $derived(points.length ? new Date(points[0].time).getTime() : 0);
  let end = $derived(points.length ? new Date(points.at(-1).time).getTime() : 1);
  let selected = $derived(points.length ? points[Math.min(points.length - 1, selectedIndex < 0 ? points.length - 2 : selectedIndex)] : null);
  const x = time => left + ((new Date(time).getTime() - start) / Math.max(1, end - start)) * (right - left);
  const primaryY = value => bottom - (value / primaryMax) * (bottom - top);
  const bidderY = value => bottom - (value / bidderMax) * (bottom - top);
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: (activity?.currency || 'usd').toUpperCase(), maximumFractionDigits: 2 }).format(value);
  const time = value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const axisTime = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function refresh() {
    const key = `${auctionId}:${selectedLot || ''}`;
    if (requesting === key) return;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const requestGeneration = ++generation;
    requesting = key;
    try {
      const query = selectedLot ? `?lotId=${encodeURIComponent(selectedLot)}` : '';
      const response = await fetch(`/api/auctions/${auctionId}/activity${query}`, { signal });
      if (!response.ok) throw new Error('Live activity is temporarily unavailable');
      const result = await response.json();
      if (requestGeneration !== generation) return;
      activity = result;
      errorMessage = '';
    } catch (err) {
      if (err.name !== 'AbortError' && requestGeneration === generation) errorMessage = err.message;
    } finally { if (requestGeneration === generation) requesting = ''; }
  }

  $effect(() => {
    auctionId; selectedLot;
    if (mounted) { selectedIndex = -1; activity = null; refresh(); }
  });
  onMount(() => {
    mounted = true;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 5000);
    return () => { ++generation; controller?.abort(); clearInterval(timer); };
  });
</script>

<section class="pumbi-panel my-5 bg-[#f7f4ee] p-4 text-[#1a2821] sm:p-5" aria-label="Auction activity">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div><p class="pumbi-eyebrow">Live activity</p><h2 class="mt-1 font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Room activity</h2></div>
    <div class="flex flex-wrap gap-5 text-right">
      {#each [['inRoom', 'In the room'], ['activeBidders', 'Bidding now'], ['totalBidders', 'Auction bidders'], ['totalBids', 'Total bids']] as [key, label]}
        <div><p class="text-2xl font-semibold tabular-nums">{activity ? activity[key] : '—'}</p><p class="text-xs text-[#6b746e]">{label}</p></div>
      {/each}
    </div>
  </div>
  <p class="mt-3 text-xs text-[#6b746e]">Room counts include distinct visitors seen within 45 seconds across the auction and its lots. Bidding now: people in the room who bid in the last 5 minutes.</p>
  {#if errorMessage}<p role="status" class="mt-3 text-sm text-amber-800">{errorMessage}{activity ? ' · Showing the last successful update.' : ''}</p>{/if}
  <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#ddd6ca] pt-4">
    <h3 class="font-semibold">{activity?.lot ? `Lot #${activity.lot.lotNumber} · Bid price & bidders` : 'Auction bids & bidders'}</h3>
    <div class="flex gap-2 text-xs">
      {#if lotId}<button type="button" class="border border-[#ddd6ca] px-3 py-2" class:chosen={scope === 'lot'} aria-pressed={scope === 'lot'} onclick={() => scope = 'lot'}>Current lot</button>{/if}
      <button type="button" class="border border-[#ddd6ca] px-3 py-2" class:chosen={scope === 'auction' || !lotId} aria-pressed={scope === 'auction' || !lotId} onclick={() => scope = 'auction'}>Whole auction</button>
    </div>
  </div>
  {#if points.length}
    <div class="mt-3 flex gap-5 text-xs"><span class="font-semibold text-[#1f5141]">━ {activity?.lot ? `Bid price (${(activity?.currency || 'usd').toUpperCase()})` : 'Cumulative bids'} · left axis</span><span class="font-semibold text-[#a95739]">━ Unique bidders · right axis</span></div>
    <div class="overflow-x-auto">
    <svg viewBox={`0 0 ${width} ${height}`} class="mt-2 min-w-[640px] w-full" role="img" aria-label={`${activity?.lot ? 'Bid price' : 'Cumulative bids'} and cumulative unique bidders over time; use the history slider below for exact values`}>
      {#each [0, 0.5, 1] as fraction}
        {@const y = bottom - fraction * (bottom - top)}
        <line x1={left} y1={y} x2={right} y2={y} stroke="#ddd6ca" />
        {#if activity?.lot || fraction !== 0.5 || primaryMax > 1}<text x={left - 9} {y} dy="4" text-anchor="end" fill="#1f5141" font-size="11">{activity?.lot ? money(primaryMax * fraction) : Math.round(primaryMax * fraction)}</text>{/if}
        {#if fraction !== 0.5 || bidderMax > 1}<text x={right + 9} {y} dy="4" fill="#a95739" font-size="11">{Math.round(bidderMax * fraction)}</text>{/if}
      {/each}
      <path d={stepPath(points, x, primaryY, primaryField)} fill="none" stroke="#1f5141" stroke-width="2.5" />
      <path d={stepPath(points, x, bidderY, 'bidders')} fill="none" stroke="#a95739" stroke-dasharray="6 4" stroke-width="2.5" />
      <text x={left} y="218" fill="#6b746e" font-size="11">{axisTime(start)}</text>
      <text x={right} y="218" text-anchor="end" fill="#6b746e" font-size="11">{axisTime(end)}</text>
      {#if selected}<line x1={x(selected.time)} x2={x(selected.time)} y1={top} y2={bottom} stroke="#6b746e" stroke-dasharray="2 4" />{/if}
    </svg>
    </div>
    <label class="block text-xs text-[#6b746e]">Inspect bid history
      <input type="range" class="mt-2 w-full accent-[#1f5141]" min="0" max={points.length - 1} value={selectedIndex < 0 ? points.length - 2 : Math.min(selectedIndex, points.length - 1)} oninput={event => selectedIndex = Number(event.currentTarget.value)} />
    </label>
    {#if selected}<p class="mt-2 text-sm tabular-nums">{time(selected.time)} · {activity?.lot ? money(selected.price) : `${selected.bids} bids`} · {selected.bidders} unique {selected.bidders === 1 ? 'bidder' : 'bidders'}</p>{/if}
    <p class="mt-2 text-xs text-[#6b746e]">Bidder line counts distinct people who have bid in this chart’s scope. Long histories are sampled to at most 120 bid events; cumulative totals include every bid.</p>
  {:else}
    <p class="py-8 text-center text-sm text-[#6b746e]">{activity ? 'No bids yet. The chart will update as bids arrive.' : errorMessage ? 'Updates will retry automatically.' : 'Loading activity…'}</p>
  {/if}
  {#if activity}<p class="mt-3 text-right text-[10px] text-[#6b746e]">Updated {time(activity.updatedAt)} · refreshes every 5 seconds</p>{/if}
</section>

<style>.chosen { background: #1f3a32; color: white; }</style>
