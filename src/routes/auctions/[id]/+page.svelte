<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import { publicHousePath } from '$lib/utils/houseSlugs.js';
  import { requiresBidderRegistration } from '$lib/utils/biddingAccess.js';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import LotGalleryTemplate from '$lib/components/LotGalleryTemplate.svelte';
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';
  import LiveAuctionDashboard from '$lib/components/LiveAuctionDashboard.svelte';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';
  import InterestTracker from '$lib/components/InterestTracker.svelte';
  import { mediaEmbedUrl } from '$lib/utils/mediaEmbed.js';
  import AuctionLiveVideo from '$lib/components/AuctionLiveVideo.svelte';
  
  let auction = $state(null);
  let lots = $state([]);
  let loading = $state(true);
  let galleryTemplate = $state('card-grid');
  let galleryTemplateSettings = $state({});
  let liveVideoUrl = $state(null);
  let liveVideoTitle = $state(null);
  let liveAudioUrl = $state(null);
  let liveAudioTitle = $state(null);
  let broadcastLive = $state(false);

  let isLive = $derived(['live', 'LIVE'].includes(auction?.status));
  let streamSrc = $derived(mediaEmbedUrl(liveVideoUrl));
  let showHeroStream = $derived(Boolean(streamSrc && !isLive && !broadcastLive));
  
  $effect(() => {
    if ($page.params.id) {
      loadAuction();
    }
  });

  onMount(() => {
    let disposed = false;
    let refreshing = false;
    async function refreshStatus() {
      if (refreshing || document.visibilityState !== 'visible') return;
      refreshing = true;
      const id = $page.params.id;
      try {
        const response = await fetch(`/api/auctions/${id}/stream`, { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json();
        if (!disposed && auction?.id === id && result.auctionStatus && auction.status.toUpperCase() !== result.auctionStatus) auction = { ...auction, status: result.auctionStatus.toLowerCase() };
      } catch { /* Keep the loaded auction during a transient connection failure. */ }
      finally { refreshing = false; }
    }
    const timer = setInterval(refreshStatus, 5000);
    document.addEventListener('visibilitychange', refreshStatus);
    return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', refreshStatus); };
  });
  
  async function loadAuction() {
    try {
      loading = true;
      const [auctionRes, lotsRes, settingsRes] = await Promise.all([
        fetch(`/api/auctions/${$page.params.id}`),
        fetch(`/api/lots?auctionId=${$page.params.id}`),
        fetch(`/api/auctions/${$page.params.id}/settings`)
      ]);
      
      auction = await auctionRes.json();
      lots = await lotsRes.json();
      
      // Load gallery template settings (public access, works for non-logged-in users)
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        galleryTemplate = settings.galleryTemplate || 'card-grid';
        galleryTemplateSettings = settings.galleryTemplateSettings || {};
        liveVideoUrl = settings.liveVideoUrl || null;
        liveVideoTitle = settings.liveVideoTitle || null;
        liveAudioUrl = settings.liveAudioUrl || null;
        liveAudioTitle = settings.liveAudioTitle || null;
      } else {
        // Fallback to defaults if settings can't be loaded
        galleryTemplate = 'card-grid';
        galleryTemplateSettings = {};
      }
    } catch (error) {
      console.error('Error loading auction:', error);
    } finally {
      loading = false;
    }
  }
  
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString(uiLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat(uiLocale(), {
      style: 'currency',
      currency: (auction?.currency || 'usd').toUpperCase()
    }).format(amount);
  }
  
  function shouldShowCountdown(auction) {
    if (!auction?.startDate || auction.status !== 'upcoming') return false;
    const startDate = new Date(auction.startDate);
    const now = new Date();
    const daysUntilStart = (startDate - now) / (1000 * 60 * 60 * 24);
    return daysUntilStart > 0 && daysUntilStart <= 30;
  }
</script>

{#if loading}
  <div class="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
    <div class="text-center">
      <PumbiLoader size="lg" label={ui("Loading auction")} />
      <p class="mt-4 text-gray-600">{ui("Loading auction...")}</p>
    </div>
  </div>
{:else if auction}
  <InterestTracker entityType="AUCTION" entityId={auction.id} />
  <div class="min-h-screen bg-[#f7f4ee]">
    {#if !isLive && !['ended', 'ENDED', 'cancelled', 'CANCELLED'].includes(auction.status)}
      <div class="mx-auto max-w-[1240px] px-4 pt-5 sm:px-6 lg:px-8">
        {#key auction.id}
          <AuctionLiveVideo auctionId={auction.id} onlivechange={live => { broadcastLive = live; }} />
        {/key}
      </div>
    {/if}
    {#if isLive}
      <LiveAuctionDashboard {auction} videoUrl={liveVideoUrl} videoTitle={liveVideoTitle} audioUrl={liveAudioUrl} audioTitle={liveAudioTitle} />
    {:else if ['ended', 'ENDED', 'cancelled', 'CANCELLED'].includes(auction.status)}
      <div class="border-b border-[#ddd6ca] bg-[#152c26] px-4 py-8 text-center text-[#f7f4ee]">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#d6b477]">{ui("Auction finished")}</p>
        <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{ui("This sale has ended")}</p>
        <p class="mt-2 text-sm text-[#91a29a]">{ui("Lot results are listed below.")}</p>
      </div>
    {/if}
    <!-- Auction Header -->
    <div class="bg-white shadow-sm">
      <div class="container mx-auto px-4 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {#if showHeroStream}
              <div class="overflow-hidden border border-[#ddd6ca] bg-black">
                <div class="aspect-video">
                  <iframe
                    src={streamSrc}
                    title={liveVideoTitle || ui("Auction live stream")}
                    class="h-full w-full"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowfullscreen
                  ></iframe>
                </div>
                {#if liveVideoTitle}
                  <p class="border-t border-[#ddd6ca] bg-[#152c26] px-4 py-3 text-sm font-semibold text-[#f7f4ee]">{liveVideoTitle}</p>
                {/if}
              </div>
              {#if liveAudioUrl}
                <div class="mt-3 border border-[#ddd6ca] bg-[#f7f4ee] p-4">
                  <p class="text-sm font-semibold text-[#1a2821]">{liveAudioTitle || ui("Live auction audio")}</p>
                  <audio controls preload="none" src={liveAudioUrl} class="mt-2 h-9 w-full"></audio>
                </div>
              {/if}
            {:else}
              <img
                src={auction.imageUrl}
                alt={auction.title}
                class="w-full h-96 object-cover border border-[#ddd6ca]"
              />
            {/if}
          </div>
          <div>
            <div class="mb-4">
              <span class="px-3 py-1 text-sm font-semibold {isLive ? 'bg-[#efe8dc] text-[#a95739]' : auction.status === 'upcoming' || auction.status === 'UPCOMING' ? 'bg-[#e8eee9] text-[#18372f]' : 'bg-[#efe8dc] text-[#435048]'}">
                {uiStatus(auction.status.toUpperCase())}
              </span>
              <span class="ms-2 bg-[#efe8dc] px-3 py-1 text-sm font-semibold text-[#18372f]">
                {ui((auction.type || 'PRIVATE').toUpperCase())}
              </span>
            </div>
            <h1 class="mb-4 font-[family-name:var(--pumbi-serif)] text-4xl font-semibold text-[#1a2821]">{auction.title}</h1>
            <p class="text-gray-600 text-lg mb-6">{auction.description}</p>
            <div class="space-y-3 mb-6">
              <div class="flex items-center text-gray-700">
                <span class="font-semibold me-2">{ui("Auction House:")}</span>
                {#if auction.auctionHouse?.slug}<a href={publicHousePath(auction.auctionHouse.slug)} class="font-semibold underline hover:text-[#18372f]">{auction.auctionHouse.name}</a>{:else}<span>{auction.auctionHouse?.name || 'N/A'}</span>{/if}
              </div>
              {#if shouldShowCountdown(auction)}
                <div class="flex items-center text-gray-700">
                  <span class="font-semibold me-2">{ui("Starting in:")}</span>
                  <span class="text-[#18372f] font-semibold">
                    <CountdownTimer targetDate={auction.startDate} label="" />
                  </span>
                </div>
              {:else}
                <div class="flex items-center text-gray-700">
                  <span class="font-semibold me-2">{ui("Start Date:")}</span>
                  <span>{formatDate(auction.startDate)}</span>
                </div>
              {/if}
              <div class="flex items-center text-gray-700">
                <span class="font-semibold me-2">{ui("End Date:")}</span>
                <span>{formatDate(auction.endDate)}</span>
              </div>
              <div class="flex items-center text-gray-700">
                <span class="font-semibold me-2">{ui("Total Lots:")}</span>
                <span>{auction.totalLots}</span>
              </div>
              {#if isLive}
                <div class="flex items-center text-red-600">
                  <span class="font-semibold me-2">{ui("Active Bids:")}</span>
                  <span>{auction.currentBids}</span>
                </div>
              {/if}
            </div>
            <div class="rounded-lg border border-gray-200 bg-[#f7f4ee] p-4 text-sm text-gray-700">
              {#if auction.type?.toUpperCase() === 'PUBLIC'}
                <p class="font-semibold text-gray-900">{ui("Pumbi public monthly auction")}</p>
                <p class="mt-1">{ui("Open to all account holders. Independent sellers may submit lots for Pumbi approval.")}</p>
                {#if auction.buyerPremiumRateSnapshot != null}
                  <p class="mt-2"><strong>{ui("Buyer premium:")}</strong> {Number(auction.buyerPremiumRateSnapshot) * 100}%</p>
                {/if}
                <a href="/dashboard/sell" class="mt-3 inline-block font-semibold text-[#18372f]">{ui("Submit an item →")}</a>
              {:else}
                <p class="font-semibold text-gray-900">{ui("Auction-house managed auction")}</p>
                <p class="mt-1">{#if requiresBidderRegistration(auction)}{ui("Anyone may browse. Bidding requires approval from")} {auction.auctionHouse?.name || ui("the auction house")}.{:else}{ui("Sign in to bid. No advance registration or approval is required.")}{/if}</p>
                {#if auction.privateHouseBuyerPremiumRateSnapshot != null}
                  <p class="mt-2"><strong>{ui("Buyer premium:")}</strong> {Number(auction.privateHouseBuyerPremiumRateSnapshot) * 100}%</p>
                {/if}
              {/if}
            </div>
            {#if auction.buyerTermsSnapshot || auction.privateHouseBuyerTermsSnapshot}
              <details class="mt-4 rounded-lg border border-gray-200 p-4">
                <summary class="cursor-pointer font-semibold">{ui("Buyer terms")}</summary>
                <p class="mt-3 whitespace-pre-wrap text-sm text-gray-700">{auction.type?.toUpperCase() === 'PUBLIC' ? auction.buyerTermsSnapshot : auction.privateHouseBuyerTermsSnapshot}</p>
              </details>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Lots Section -->
    <div id="all-lots" class="container mx-auto px-4 py-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-6">{ui("Lots (")}{lots.length})</h2>
      
      {#if lots.length === 0}
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-600">{ui("No lots available for this auction yet.")}</p>
        </div>
      {:else}
        <LotGalleryTemplate 
          {lots} 
          template={galleryTemplate}
          templateSettings={galleryTemplateSettings}
          {formatCurrency}
        />
      {/if}
    </div>
  </div>
{:else}
  <div class="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
    <div class="text-center">
      <p class="text-gray-600 text-lg">{ui("Auction not found")}</p>
      <button
        onclick={() => goto('/')}
        class="mt-4 px-6 py-2 bg-[#18372f] text-white rounded-lg hover:bg-[#152c26]"
      >
        {ui("Back to Auctions")}
      </button>
    </div>
  </div>
{/if}
