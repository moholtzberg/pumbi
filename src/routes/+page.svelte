<script>
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';

  let { data } = $props();
  let auctions = $state([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let statusFilter = $state('all');

  $effect(() => {
    statusFilter;
    loadAuctions();
  });

  async function loadAuctions() {
    try {
      loading = true;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await fetch(`/api/auctions?${params}`);
      if (!response.ok) throw new Error('Unable to load auctions');
      auctions = await response.json();
    } catch (error) {
      console.error('Error loading auctions:', error);
      auctions = [];
    } finally {
      loading = false;
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'To be announced';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0
    }).format(value || 0);
  }

  function getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
      case 'live': return 'bg-red-100 text-red-700';
      case 'upcoming': return 'bg-amber-100 text-amber-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  function filteredAuctions() {
    if (!searchQuery.trim()) return auctions;
    const query = searchQuery.toLowerCase();
    return auctions.filter((auction) =>
      (auction.title || '').toLowerCase().includes(query) ||
      (auction.description || '').toLowerCase().includes(query) ||
      (auction.auctionHouse?.name || auction.sellerName || '').toLowerCase().includes(query)
    );
  }

  function shouldShowCountdown(auction) {
    if (!auction.startDate || auction.status?.toLowerCase() !== 'upcoming') return false;
    const daysUntilStart = (new Date(auction.startDate) - new Date()) / 86_400_000;
    return daysUntilStart > 0 && daysUntilStart <= 30;
  }
</script>

<svelte:head>
  <title>Pumbi | Discover Judaica auctions</title>
  <meta name="description" content="Discover the most watched lots, popular auctions, and active Judaica listings on Pumbi." />
</svelte:head>

<div class="min-h-screen bg-[#f7f5f0] text-slate-900">
  <section class="overflow-hidden bg-slate-950 text-white">
    <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:flex lg:items-end lg:justify-between lg:gap-16 lg:px-8 lg:py-20">
      <div class="max-w-3xl">
        <p class="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">Live marketplace discovery</p>
        <h1 class="text-4xl font-semibold leading-tight sm:text-6xl">Find the lots everyone is talking about.</h1>
        <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Explore watched Judaica, popular auctions, and the items attracting the most bids right now.</p>
      </div>
      <label class="mt-10 block w-full max-w-xl lg:mt-0" aria-label="Search auctions">
        <span class="sr-only">Search auctions</span>
        <input bind:value={searchQuery} type="search" placeholder="Search auctions or auction houses…" class="w-full rounded-2xl border border-white/15 bg-white px-5 py-4 text-base text-slate-950 shadow-xl outline-none ring-amber-400 transition focus:ring-4" />
      </label>
    </div>
  </section>

  <main class="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
    {#if data.mostWatchedLots.length}
      <section aria-labelledby="watched-heading">
        <div class="mb-6 flex items-end justify-between gap-4">
          <div><p class="text-sm font-semibold uppercase tracking-widest text-amber-700">Trending now</p><h2 id="watched-heading" class="mt-1 text-3xl font-semibold">Most watched lots</h2></div>
          <span class="hidden text-sm text-slate-500 sm:block">Ranked by watchlists</span>
        </div>
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {#each data.mostWatchedLots as lot, index}
            <a href={`/lots/${lot.id}`} class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div class="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-amber-100 to-slate-200">
                {#if lot.imageUrl}<img src={lot.imageUrl} alt={lot.title} class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />{/if}
                <span class="absolute left-4 top-4 rounded-full bg-slate-950/85 px-3 py-1 text-xs font-semibold text-white">#{index + 1} watched</span>
              </div>
              <div class="p-5">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{lot.auction.auctionHouse.name} · {lot.auction.title}</p>
                <h3 class="mt-2 line-clamp-2 text-xl font-semibold group-hover:text-amber-700">{lot.title}</h3>
                <div class="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
                  <div><p class="text-xs text-slate-500">Current bid</p><p class="font-semibold">{formatMoney(lot.currentBid || lot.startingBid)}</p></div>
                  <div class="text-right"><p class="font-semibold text-rose-600">♥ {lot.watchersCount}</p><p class="text-xs text-slate-500">{lot.bidCount} {lot.bidCount === 1 ? 'bid' : 'bids'}</p></div>
                </div>
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    {#if data.popularAuctions.length}
      <section aria-labelledby="popular-heading">
        <div class="mb-6"><p class="text-sm font-semibold uppercase tracking-widest text-amber-700">The crowd is gathering</p><h2 id="popular-heading" class="mt-1 text-3xl font-semibold">Most subscribed auctions</h2></div>
        <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {#each data.popularAuctions as auction}
            <a href={`/auctions/${auction.id}`} class="group flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl bg-slate-900 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:bg-slate-800 hover:shadow-xl">
              <div>
                <div class="flex items-center justify-between gap-3"><span class="rounded-full px-3 py-1 text-xs font-semibold {getStatusBadgeClass(auction.status)}">{auction.status}</span><span class="text-sm font-semibold text-amber-300">{auction.subscriberCount} {auction.subscriberCount === 1 ? 'subscriber' : 'subscribers'}</span></div>
                <p class="mt-8 text-sm text-slate-400">{auction.auctionHouse.name}</p>
                <h3 class="mt-2 text-2xl font-semibold leading-tight group-hover:text-amber-300">{auction.title}</h3>
              </div>
              <div class="mt-8 flex items-center justify-between border-t border-white/10 pt-4 text-sm text-slate-300"><span>{auction.lotCount} {auction.lotCount === 1 ? 'lot' : 'lots'}</span><span>{auction.status === 'LIVE' ? 'Live now' : `Starts ${formatDate(auction.startDate)}`} →</span></div>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    {#if data.mostActiveLots.length}
      <section aria-labelledby="active-heading">
        <div class="mb-6"><p class="text-sm font-semibold uppercase tracking-widest text-amber-700">Watchers + bids</p><h2 id="active-heading" class="mt-1 text-3xl font-semibold">Items with the most activity</h2></div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each data.mostActiveLots as lot}
            <a href={`/lots/${lot.id}`} class="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-amber-400 hover:shadow-lg">
              <div class="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-amber-100 to-slate-200">{#if lot.imageUrl}<img src={lot.imageUrl} alt={lot.title} class="h-full w-full object-cover transition group-hover:scale-105" />{/if}</div>
              <div class="min-w-0 flex-1 py-1">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
                  <span class="text-rose-600">♥ {lot.watchersCount} {lot.watchersCount === 1 ? 'watcher' : 'watchers'}</span>
                  <span class="text-slate-500">{lot.bidCount} {lot.bidCount === 1 ? 'bid' : 'bids'}</span>
                </div>
                <h3 class="mt-2 line-clamp-2 font-semibold group-hover:text-amber-700">{lot.title}</h3>
                <p class="mt-2 truncate text-xs text-slate-500">{lot.auction.title}</p>
                <p class="mt-1 text-sm font-semibold">{formatMoney(lot.currentBid || lot.startingBid)}</p>
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <section aria-labelledby="all-auctions-heading">
      <div class="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="text-sm font-semibold uppercase tracking-widest text-amber-700">Browse the catalog</p><h2 id="all-auctions-heading" class="mt-1 text-3xl font-semibold">All auctions</h2></div>
        <div class="flex flex-wrap gap-2" aria-label="Filter auctions by status">
          {#each [['all', 'All'], ['live', 'Live now'], ['upcoming', 'Upcoming'], ['ended', 'Ended']] as filter}
            <button onclick={() => statusFilter = filter[0]} class="rounded-full px-4 py-2 text-sm font-semibold transition {statusFilter === filter[0] ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}">{filter[1]}</button>
          {/each}
        </div>
      </div>

      {#if loading}
        <div class="py-16 text-center"><div class="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-amber-600"></div><p class="mt-4 text-slate-500">Loading auctions…</p></div>
      {:else if filteredAuctions().length === 0}
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-600">No auctions found. Try another search or filter.</div>
      {:else}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {#each filteredAuctions() as auction}
            <a href={`/auctions/${auction.id}`} class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div class="relative h-48 overflow-hidden bg-gradient-to-br from-amber-100 to-slate-200">
                {#if auction.imageUrl}<img src={auction.imageUrl} alt={auction.title} class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />{/if}
                <span class="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold {getStatusBadgeClass(auction.status)}">{auction.status.toUpperCase()}</span>
                <span class="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">{(auction.type || 'PRIVATE').toUpperCase()}</span>
              </div>
              <div class="p-6">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{auction.auctionHouse?.name || 'Pumbi'}</p>
                <h3 class="mt-2 text-xl font-semibold group-hover:text-amber-700">{auction.title}</h3>
                <p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{auction.description || 'Explore the lots in this auction.'}</p>
                <div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm"><span class="text-slate-500">{auction.totalLots} {auction.totalLots === 1 ? 'lot' : 'lots'}</span>{#if shouldShowCountdown(auction)}<CountdownTimer targetDate={auction.startDate} label="Starts in" />{:else}<span class="font-semibold">{formatDate(auction.startDate)}</span>{/if}</div>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  </main>
</div>
