<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';

  let { auction, videoUrl = null, videoTitle = null, audioUrl = null, audioTitle = null } = $props();
  let liveData = $state({
    currentLot: null,
    upcomingLots: [],
    recentBids: [],
    timing: null,
    lobby: true,
    biddingOpen: false
  });
  let loading = $state(true);
  let refreshTimer;
  let session = $state(null);
  let bidding = $state(false);
  let bidError = $state('');
  let bidSuccess = $state(false);
  let bidSuccessTimer;

  let nextBidAmount = $derived.by(() => {
    const lot = liveData.currentLot;
    if (!lot) return 0;
    const currentBid = Number(lot.currentBid) || 0;
    const startingBid = Number(lot.startingBid) || 0;
    const increment = Number(lot.bidIncrement) || 0;
    return Math.max(startingBid, currentBid + increment);
  });

  let canBidNow = $derived(Boolean(liveData.currentLot && liveData.biddingOpen && nextBidAmount > 0));
  let upcomingLots = $derived(liveData.upcomingLots || []);

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

  async function loadSession() {
    try {
      const res = await fetch('/auth/session', { credentials: 'include' });
      if (res.ok) session = await res.json();
    } catch {
      session = null;
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

  async function placeBid() {
    const lot = liveData.currentLot;
    if (!lot) return;

    bidError = '';
    bidSuccess = false;

    if (!session?.user) {
      goto(`/auth/login?redirect=${encodeURIComponent($page.url.pathname)}`);
      return;
    }

    if (!liveData.biddingOpen) {
      bidError = liveData.lobby
        ? 'The auctioneer has not started bidding on this lot yet'
        : 'This lot is not open for bidding yet';
      return;
    }

    bidding = true;
    try {
      const response = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lotId: lot.id, amount: nextBidAmount })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 401) {
          goto(`/auth/login?redirect=${encodeURIComponent($page.url.pathname)}`);
          return;
        }
        throw new Error(err.message || err.error || (typeof err === 'string' ? err : 'Failed to place bid'));
      }

      bidSuccess = true;
      clearTimeout(bidSuccessTimer);
      bidSuccessTimer = setTimeout(() => {
        bidSuccess = false;
      }, 3000);
      await refresh();
    } catch (err) {
      bidError = err.message || 'Failed to place bid';
    } finally {
      bidding = false;
    }
  }

  function bidButtonLabel() {
    if (bidding) return 'Placing bid…';
    if (!session?.user) return `Log in to bid ${money(nextBidAmount)}`;
    if (!liveData.biddingOpen) {
      return liveData.lobby ? 'Waiting for auctioneer' : 'Bidding closed';
    }
    return `Bid ${money(nextBidAmount)}`;
  }

  function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  }

  function time(value) {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  onMount(() => {
    loadSession();
    refresh();
    refreshTimer = setInterval(refresh, 2000);
  });
  onDestroy(() => {
    clearInterval(refreshTimer);
    clearTimeout(bidSuccessTimer);
  });
</script>

<section class="bg-slate-950 pb-24 text-white md:pb-0">
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
      <div class="grid gap-5 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.5fr)_minmax(260px,0.85fr)]">
        <!-- Left: upcoming lots -->
        <aside class="order-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 xl:order-1">
          <div class="border-b border-white/10 px-5 py-4">
            <h2 class="font-black">Upcoming lots</h2>
            <p class="text-xs text-slate-400">Next on the block</p>
          </div>
          {#if upcomingLots.length === 0}
            <p class="p-6 text-sm text-slate-400">No more lots queued.</p>
          {:else}
            <div class="max-h-[720px] divide-y divide-white/10 overflow-y-auto">
              {#each upcomingLots as lot, index}
                <a href={`/lots/${lot.id}`} class="flex gap-3 p-4 transition hover:bg-white/5">
                  <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                    {#if lot.imageUrl}
                      <img src={lot.imageUrl} alt="" class="h-full w-full object-cover" />
                    {:else}
                      <div class="grid h-full place-items-center text-[10px] text-slate-500">No img</div>
                    {/if}
                    <span class="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">{index + 1}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Lot #{lot.lotNumber}</p>
                    <p class="truncate font-bold text-white">{lot.title}</p>
                    <p class="mt-1 text-sm font-semibold text-emerald-300">{money(lot.currentBid || lot.startingBid)}</p>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </aside>

        <!-- Center: stream + current lot -->
        <div class="order-1 space-y-5 xl:order-2">
          {#if embedUrl(videoUrl)}
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
              <div class="aspect-video"><iframe src={embedUrl(videoUrl)} title={videoTitle || 'Live auction video'} class="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
              {#if videoTitle}<p class="border-t border-white/10 px-4 py-3 text-sm font-semibold text-slate-200">{videoTitle}</p>{/if}
            </div>
          {/if}
          {#if audioUrl}
            <div class="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xl" aria-hidden="true">♫</div>
              <div class="min-w-0 flex-1"><p class="font-bold">{audioTitle || 'Live auction audio'}</p><p class="text-xs text-slate-400">Listen to the auctioneer while you bid</p><audio controls preload="none" src={audioUrl} class="mt-2 h-9 w-full"></audio></div>
            </div>
          {/if}

          <article class="grid overflow-hidden rounded-2xl bg-white text-slate-950 shadow-2xl md:grid-cols-[minmax(200px,0.85fr)_1.15fr]">
            <div class="bg-slate-100">
              {#if liveData.currentLot.imageUrl}<img src={liveData.currentLot.imageUrl} alt={liveData.currentLot.title} class="h-full min-h-64 w-full object-cover" />{:else}<div class="grid h-full min-h-64 place-items-center text-slate-400">No image</div>{/if}
            </div>
            <div class="flex flex-col p-5 lg:p-7">
              <p class="text-xs font-black uppercase tracking-widest text-violet-700">
                {liveData.biddingOpen ? 'On the block' : liveData.lobby ? 'Up next' : 'Coming up'} · Lot #{liveData.currentLot.lotNumber}
              </p>
              <h2 class="mt-2 text-2xl font-black lg:text-3xl">{liveData.currentLot.title}</h2>
              <p class="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{liveData.currentLot.description || ''}</p>
              <div class="mt-auto grid grid-cols-2 gap-4 pt-6">
                <div><p class="text-xs font-bold uppercase tracking-wide text-slate-500">Current price</p><p class="mt-1 text-3xl font-black text-violet-700">{money(liveData.currentLot.currentBid || liveData.currentLot.startingBid)}</p></div>
                <div class="text-right">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Time remaining</p>
                  <p class="mt-1 text-3xl font-black text-red-600">
                    {#if liveData.biddingOpen && liveData.currentLot.endTime}
                      <CountdownTimer targetDate={liveData.currentLot.endTime} label="" />
                    {:else}
                      —
                    {/if}
                  </p>
                </div>
              </div>

              {#if bidError}
                <p class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{bidError}</p>
              {/if}
              {#if bidSuccess}
                <p class="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Bid placed successfully</p>
              {/if}

              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onclick={placeBid}
                  disabled={bidding || !nextBidAmount || (Boolean(session?.user) && !canBidNow)}
                  class="rounded-xl bg-violet-700 px-5 py-3.5 text-center text-base font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bidButtonLabel()}
                </button>
                <a
                  href={`/lots/${liveData.currentLot.id}`}
                  class="rounded-xl border-2 border-slate-300 bg-white px-5 py-3.5 text-center text-base font-black text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                >
                  View lot details
                </a>
              </div>
            </div>
          </article>
        </div>

        <!-- Right: recent bids -->
        <aside class="order-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div class="border-b border-white/10 px-5 py-4">
            <h2 class="font-black">Recent bids</h2>
            <p class="text-xs text-slate-400">Updates automatically</p>
          </div>
          {#if liveData.recentBids.length === 0}
            <p class="p-6 text-sm text-slate-400">No bids yet.</p>
          {:else}
            <div class="max-h-[720px] divide-y divide-white/10 overflow-y-auto">
              {#each liveData.recentBids as bid}
                <div class={`p-4 ${bid.isCurrentLot ? 'bg-violet-500/10' : ''}`}>
                  <div class="flex items-center justify-between gap-4">
                    <div class="min-w-0">
                      <p class="truncate font-bold">{bid.bidderName}</p>
                      <p class="truncate text-xs text-slate-400">Lot #{bid.lotNumber} · {bid.lotTitle}</p>
                    </div>
                    <div class="text-right">
                      <p class="font-black text-emerald-300">{money(bid.amount)}</p>
                      <p class="text-xs text-slate-500">{time(bid.timestamp)}</p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </aside>
      </div>

      <!-- Sticky actions so Bid / Details stay reachable while watching video -->
      <div class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.18)] backdrop-blur md:hidden">
        <div class="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button
            type="button"
            onclick={placeBid}
            disabled={bidding || !nextBidAmount || (Boolean(session?.user) && !canBidNow)}
            class="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {bidButtonLabel()}
          </button>
          <a
            href={`/lots/${liveData.currentLot.id}`}
            class="rounded-xl border-2 border-slate-300 px-4 py-3 text-center text-sm font-black text-slate-800"
          >
            Lot details
          </a>
        </div>
      </div>
    {/if}
  </div>
</section>
