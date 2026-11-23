<script>
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';
  let { info, cameraLive = false, preview = false } = $props();
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0);
</script>

<div class="broadcast-overlay pointer-events-none absolute inset-0 z-10 flex flex-col justify-between text-white" aria-label="Auction broadcast information">
  <div class="flex min-w-0 items-start justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent p-3 sm:p-4">
    <div class="min-w-0"><div class="flex items-center gap-2"><span class="bg-[#f7f4ee] px-2 py-1 font-[family-name:var(--pumbi-serif)] text-lg font-bold leading-none text-[#18372f]">{info.platform}</span><span class="truncate text-[10px] font-semibold uppercase tracking-wider text-[#e5c992]" title={info.house}>{info.house}</span></div><p class="mt-2 truncate text-xs font-medium text-white/90" title={info.title}>{info.title}</p></div>
    <span class="shrink-0 border border-white/25 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">{#if preview}Preview{:else if cameraLive}<span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500"></span>Live{:else}Auction live{/if}</span>
  </div>
  <div class="bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-8">
    <div class="mx-3 mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-l-[3px] border-[#c69a56] pl-3 sm:mx-4 sm:mb-4">
      <div class="min-w-0"><p class="text-[9px] font-bold uppercase tracking-[0.15em] text-[#e5c992]">{info.currentLot ? `${info.biddingOpen ? 'On the block' : 'Coming up'} · Lot #${info.currentLot.lotNumber}` : 'The live auction room'}</p><p class="mt-1 line-clamp-2 text-sm font-semibold leading-tight sm:text-lg" title={info.currentLot?.title}>{info.currentLot?.title || 'Waiting for the next lot'}</p></div>
      {#if info.currentLot}<div class="text-right"><p class="text-[9px] uppercase tracking-wider text-white/60">{info.currentLot.priceLabel}</p><p class="text-lg font-semibold tabular-nums text-[#e5c992] sm:text-2xl">{money(info.currentLot.price)}</p>{#if info.currentLot.endTime}<div class="mt-1 text-xs tabular-nums"><CountdownTimer targetDate={info.currentLot.endTime} label="" /></div>{/if}</div>{/if}
    </div>
    <div class="flex min-w-0 items-center gap-2 border-t border-white/15 bg-[#18372f]/95 px-3 py-2 text-[10px] sm:px-4 sm:text-xs"><span class="shrink-0 font-bold uppercase tracking-wider text-[#e5c992]">Up next</span><span class="truncate">{info.nextLot ? `Lot #${info.nextLot.lotNumber} · ${info.nextLot.title}` : info.currentLot ? 'Final lot · no further lots queued' : 'Waiting for the auctioneer'}</span></div>
  </div>
</div>
