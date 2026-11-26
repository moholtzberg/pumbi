<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import CountdownTimer from '$lib/components/CountdownTimer.svelte';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';

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
      if (!response.ok) throw new Error(ui("Unable to load auctions"));
      auctions = await response.json();
    } catch (error) {
      console.error('Error loading auctions:', error);
      auctions = [];
    } finally {
      loading = false;
    }
  }

  function formatDate(dateString) {
    if (!dateString) return ui("To be announced");
    return new Date(dateString).toLocaleDateString(uiLocale(), {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function formatMoney(value, currency = 'usd') {
    return new Intl.NumberFormat(uiLocale(), {
      style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0
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
  <title>{ui("Pumbi | Discover Judaica auctions")}</title>
  <meta name="description" content={ui("Discover the most watched lots, popular auctions, and active Judaica listings on Pumbi.")} />
</svelte:head>

<div class="min-h-screen bg-[#f7f4ee] text-slate-900">
  <section class="overflow-hidden bg-slate-950 text-white">
    <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:flex lg:items-end lg:justify-between lg:gap-16 lg:px-8 lg:py-20">
      <div class="max-w-3xl">
        <p class="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#d6b477]">{ui("Live marketplace discovery")}</p>
        <h1 class="text-4xl font-semibold leading-tight sm:text-6xl">{ui("Find the lots everyone is talking about.")}</h1>
        <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{ui("Explore watched Judaica, popular auctions, and the items attracting the most bids right now.")}</p>
      </div>
      <label class="mt-10 block w-full max-w-xl lg:mt-0" aria-label={ui("Search auctions")}>
        <span class="sr-only">{ui("Search auctions")}</span>
        <input bind:value={searchQuery} type="search" placeholder={ui("Search auctions or auction houses…")} class="w-full rounded-sm border border-white/15 bg-white px-5 py-4 text-base text-slate-950 shadow-xl outline-none ring-[#a95739]/40 transition focus:ring-4" />
      </label>
    </div>
  </section>

  <main class="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
    <section id="watched-heading" class="scroll-mt-24" aria-label={ui("Most watched lots")}>
        <div class="mb-6 flex items-end justify-between gap-4">
          <div><p class="text-sm font-semibold uppercase tracking-widest text-[#a95739]">{ui("Trending now")}</p><h2 class="mt-1 text-3xl font-semibold">{ui("Most watched lots")}</h2></div>
          <span class="hidden text-sm text-slate-500 sm:block">{ui("Ranked by watchlists")}</span>
        </div>
        {#if data.mostWatchedLots.length}
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {#each data.mostWatchedLots as lot, index}
            <a href={`/lots/${lot.id}`} class="group overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div class="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#efe8dc] to-slate-200">
                {#if lot.imageUrl}<img src={lot.imageUrl} alt={lot.title} class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />{/if}
                <span class="absolute left-4 top-4 rounded-sm bg-slate-950/85 px-3 py-1 text-xs font-semibold text-white">#{index + 1} {ui("watched")}</span>
              </div>
              <div class="p-5">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{lot.auction.auctionHouse.name} · {lot.auction.title}</p>
                <h3 class="mt-2 line-clamp-2 text-xl font-semibold group-hover:text-[#a95739]">{lot.title}</h3>
                <div class="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
                  <div><p class="text-xs text-slate-500">{ui("Current bid")}</p><p class="font-semibold">{formatMoney(lot.currentBid || lot.startingBid, lot.auction?.currency)}</p></div>
                  <div class="text-end"><p class="font-semibold text-rose-600">♥ {lot.watchersCount}</p><p class="text-xs text-slate-500">{lot.bidCount} {lot.bidCount === 1 ? ui("bid") : ui("bids")}</p></div>
                </div>
              </div>
            </a>
          {/each}
        </div>
        {:else}
          <p class="text-sm text-slate-500">{ui("No watched lots yet.")}</p>
        {/if}
    </section>

    <section id="popular-heading" class="scroll-mt-24" aria-label={ui("Most subscribed auctions")}>
        <div class="mb-6"><p class="text-sm font-semibold uppercase tracking-widest text-[#a95739]">{ui("The crowd is gathering")}</p><h2 class="mt-1 text-3xl font-semibold">{ui("Most subscribed auctions")}</h2></div>
        {#if data.popularAuctions.length}
        <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {#each data.popularAuctions as auction}
            <a href={`/auctions/${auction.id}`} class="group flex min-h-64 flex-col justify-between overflow-hidden rounded-sm bg-slate-900 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:bg-slate-800 hover:shadow-xl">
              <div>
                <div class="flex items-center justify-between gap-3"><span class="rounded-sm px-3 py-1 text-xs font-semibold {getStatusBadgeClass(auction.status)}">{uiStatus(auction.status)}</span><span class="text-sm font-semibold text-[#d6b477]">{auction.subscriberCount} {auction.subscriberCount === 1 ? ui("subscriber") : ui("subscribers")}</span></div>
                <p class="mt-8 text-sm text-slate-400">{auction.auctionHouse.name}</p>
                <h3 class="mt-2 text-2xl font-semibold leading-tight group-hover:text-[#d6b477]">{auction.title}</h3>
              </div>
              <div class="mt-8 flex items-center justify-between border-t border-white/10 pt-4 text-sm text-slate-300"><span>{auction.lotCount} {auction.lotCount === 1 ? ui("lot") : ui("lots")}</span><span>{auction.status === 'LIVE' ? ui("Live now") : ui("Starts {value0}", { value0: formatDate(auction.startDate) })} →</span></div>
            </a>
          {/each}
        </div>
        {:else}
          <p class="text-sm text-slate-500">{ui("No auctions to show yet.")}</p>
        {/if}
    </section>

    <section id="active-heading" class="scroll-mt-24" aria-label={ui("Items with the most activity")}>
        <div class="mb-6"><p class="text-sm font-semibold uppercase tracking-widest text-[#a95739]">{ui("Watchers + bids")}</p><h2 class="mt-1 text-3xl font-semibold">{ui("Items with the most activity")}</h2></div>
        {#if data.mostActiveLots.length}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each data.mostActiveLots as lot}
            <a href={`/lots/${lot.id}`} class="group flex gap-4 rounded-sm border border-slate-200 bg-white p-3 shadow-sm transition hover:border-[#a95739] hover:shadow-lg">
              <div class="h-28 w-28 shrink-0 overflow-hidden rounded-sm bg-gradient-to-br from-[#efe8dc] to-slate-200">{#if lot.imageUrl}<img src={lot.imageUrl} alt={lot.title} class="h-full w-full object-cover transition group-hover:scale-105" />{/if}</div>
              <div class="min-w-0 flex-1 py-1">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
                  <span class="text-rose-600">♥ {lot.watchersCount} {lot.watchersCount === 1 ? ui("watcher") : ui("watchers")}</span>
                  <span class="text-slate-500">{lot.bidCount} {lot.bidCount === 1 ? ui("bid") : ui("bids")}</span>
                </div>
                <h3 class="mt-2 line-clamp-2 font-semibold group-hover:text-[#a95739]">{lot.title}</h3>
                <p class="mt-2 truncate text-xs text-slate-500">{lot.auction.title}</p>
                <p class="mt-1 text-sm font-semibold">{formatMoney(lot.currentBid || lot.startingBid, lot.auction?.currency)}</p>
              </div>
            </a>
          {/each}
        </div>
        {:else}
          <p class="text-sm text-slate-500">{ui("No active lots yet.")}</p>
        {/if}
    </section>

    <section id="all-auctions-heading" class="scroll-mt-24" aria-label={ui("All auctions")}>
      <div class="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="text-sm font-semibold uppercase tracking-widest text-[#a95739]">{ui("Browse the catalog")}</p><h2 class="mt-1 text-3xl font-semibold">{ui("All auctions")}</h2></div>
        <div class="flex flex-wrap gap-2" aria-label={ui("Filter auctions by status")}>
          {#each [['all', 'All'], ['live', 'Live now'], ['upcoming', 'Upcoming'], ['ended', 'Ended']] as filter}
            <button onclick={() => statusFilter = filter[0]} class="rounded-sm px-4 py-2 text-sm font-semibold transition {statusFilter === filter[0] ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}">{ui(filter[1])}</button>
          {/each}
        </div>
      </div>

      {#if loading}
        <div class="py-16 text-center"><PumbiLoader size="md" label={ui("Loading auctions")} /><p class="mt-4 text-slate-500">{ui("Loading auctions…")}</p></div>
      {:else if filteredAuctions().length === 0}
        <div class="rounded-sm border border-dashed border-slate-300 bg-white py-16 text-center text-slate-600">{ui("No auctions found. Try another search or filter.")}</div>
      {:else}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {#each filteredAuctions() as auction}
            <a href={`/auctions/${auction.id}`} class="group overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div class="relative h-48 overflow-hidden bg-gradient-to-br from-[#efe8dc] to-slate-200">
                {#if auction.imageUrl}<img src={auction.imageUrl} alt={auction.title} class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />{/if}
                <span class="absolute right-4 top-4 rounded-sm px-3 py-1 text-xs font-semibold {getStatusBadgeClass(auction.status)}">{uiStatus(auction.status.toUpperCase())}</span>
                <span class="absolute left-4 top-4 rounded-sm bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">{ui((auction.type || 'PRIVATE').toUpperCase())}</span>
              </div>
              <div class="p-6">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{auction.auctionHouse?.name || 'Pumbi'}</p>
                <h3 class="mt-2 text-xl font-semibold group-hover:text-[#a95739]">{auction.title}</h3>
                <p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{auction.description || ui("Explore the lots in this auction.")}</p>
                <div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm"><span class="text-slate-500">{auction.totalLots} {auction.totalLots === 1 ? ui("lot") : ui("lots")}</span>{#if shouldShowCountdown(auction)}<CountdownTimer targetDate={auction.startDate} label={ui("Starts in")} />{:else}<span class="font-semibold">{formatDate(auction.startDate)}</span>{/if}</div>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  </main>
</div>
