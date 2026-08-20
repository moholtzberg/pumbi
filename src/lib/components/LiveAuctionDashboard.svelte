<script>
  import { onMount, onDestroy } from 'svelte';
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';

  let { auction, videoUrl = null, videoTitle = null } = $props();
  let liveData = $state({ currentLot: null, recentBids: [], timing: null });
  let loading = $state(true);
  let refreshTimer;

  function embedUrl(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return null;
      if (parsed.hostname === 'youtu.be') return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
      if (parsed.hostname.includes('youtube.com')) {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      if (parsed.hostname.includes('vimeo.com') && /^\/\d+/.test(parsed.pathname)) {
        return `https://player.vimeo.com/video/${parsed.pathname.split('/')[1]}`;
      }
      return url;
    } catch {
      return null;
    }
  }

  async function refresh() {
    try {
      const response = await fetch(`/api/auctions/${auction.id}/live`);
      if (response.ok) liveData = await response.json();
    } finally {
      loading = false;
    }
  }

  function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  }

  function time(value) {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  onMount(() => {
    refresh();
    refreshTimer = setInterval(refresh, 2000);
  });
  onDestroy(() => clearInterval(refreshTimer));
</script>

<section class="bg-slate-950 text-white">
  <div class="container mx-auto px-4 py-6 lg:py-8">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-300"><span class="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500"></span> Live auction</div>
        <h1 class="mt-2 text-2xl font-black lg:text-3xl">{auction.title}</h1>
      </div>
      <a href="#all-lots" class="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">Browse all lots</a>
    </div>

    {#if loading}
      <div class="rounded-2xl bg-white/5 p-12 text-center text-slate-300">Loading the live room…</div>
    {:else if !liveData.currentLot}
      <div class="rounded-2xl bg-white/5 p-12 text-center"><p class="text-xl font-bold">Waiting for the next lot</p><p class="mt-2 text-slate-400">The auctioneer has not put a lot on the block yet.</p></div>
    {:else}
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div class="space-y-5">
          {#if embedUrl(videoUrl)}
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
              <div class="aspect-video"><iframe src={embedUrl(videoUrl)} title={videoTitle || 'Live auction video'} class="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
              {#if videoTitle}<p class="border-t border-white/10 px-4 py-3 text-sm font-semibold text-slate-200">{videoTitle}</p>{/if}
            </div>
          {/if}

          <article class="grid overflow-hidden rounded-2xl bg-white text-slate-950 shadow-2xl md:grid-cols-[minmax(240px,0.85fr)_1.15fr]">
            <div class="bg-slate-100">
              {#if liveData.currentLot.imageUrl}<img src={liveData.currentLot.imageUrl} alt={liveData.currentLot.title} class="h-full min-h-72 w-full object-cover" />{:else}<div class="grid h-full min-h-72 place-items-center text-slate-400">No image</div>{/if}
            </div>
            <div class="flex flex-col p-6 lg:p-8">
              <p class="text-xs font-black uppercase tracking-widest text-violet-700">On the block · Lot #{liveData.currentLot.lotNumber}</p>
              <h2 class="mt-2 text-2xl font-black lg:text-3xl">{liveData.currentLot.title}</h2>
              <p class="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{liveData.currentLot.description || ''}</p>
              <div class="mt-auto grid grid-cols-2 gap-4 pt-7">
                <div><p class="text-xs font-bold uppercase tracking-wide text-slate-500">Current price</p><p class="mt-1 text-3xl font-black text-violet-700">{money(liveData.currentLot.currentBid)}</p></div>
                <div class="text-right"><p class="text-xs font-bold uppercase tracking-wide text-slate-500">Time remaining</p><p class="mt-1 text-3xl font-black text-red-600"><CountdownTimer targetDate={liveData.currentLot.endTime} label="" /></p></div>
              </div>
              <a href={`/lots/${liveData.currentLot.id}`} class="mt-6 rounded-xl bg-violet-700 px-5 py-3 text-center font-black text-white hover:bg-violet-800">View lot and bid</a>
            </div>
          </article>
        </div>

        <aside class="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div class="border-b border-white/10 px-5 py-4"><h2 class="font-black">Recent bids</h2><p class="text-xs text-slate-400">Updates automatically</p></div>
          {#if liveData.recentBids.length === 0}<p class="p-6 text-sm text-slate-400">No bids yet.</p>{:else}<div class="max-h-[680px] divide-y divide-white/10 overflow-y-auto">{#each liveData.recentBids as bid}<div class={`p-4 ${bid.isCurrentLot ? 'bg-violet-500/10' : ''}`}><div class="flex items-center justify-between gap-4"><div class="min-w-0"><p class="truncate font-bold">{bid.bidderName}</p><p class="truncate text-xs text-slate-400">Lot #{bid.lotNumber} · {bid.lotTitle}</p></div><div class="text-right"><p class="font-black text-emerald-300">{money(bid.amount)}</p><p class="text-xs text-slate-500">{time(bid.timestamp)}</p></div></div></div>{/each}</div>{/if}
        </aside>
      </div>
    {/if}
  </div>
</section>
