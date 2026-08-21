<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import LotGalleryTemplate from '$lib/components/LotGalleryTemplate.svelte';
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';
  import LiveAuctionDashboard from '$lib/components/LiveAuctionDashboard.svelte';
  
  let auction = $state(null);
  let lots = $state([]);
  let loading = $state(true);
  let galleryTemplate = $state('card-grid');
  let galleryTemplateSettings = $state({});
  let liveVideoUrl = $state(null);
  let liveVideoTitle = $state(null);
  let liveAudioUrl = $state(null);
  let liveAudioTitle = $state(null);
  
  $effect(() => {
    if ($page.params.id) {
      loadAuction();
    }
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
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
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600">Loading auction...</p>
    </div>
  </div>
{:else if auction}
  <div class="min-h-screen bg-gray-50">
    {#if auction.status === 'live'}
      <LiveAuctionDashboard {auction} videoUrl={liveVideoUrl} videoTitle={liveVideoTitle} audioUrl={liveAudioUrl} audioTitle={liveAudioTitle} />
    {/if}
    <!-- Auction Header -->
    <div class="bg-white shadow-sm">
      <div class="container mx-auto px-4 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <img
              src={auction.imageUrl}
              alt={auction.title}
              class="w-full h-96 object-cover rounded-lg shadow-lg"
            />
          </div>
          <div>
            <div class="mb-4">
              <span class="px-3 py-1 rounded-full text-sm font-semibold {auction.status === 'live' ? 'bg-red-100 text-red-800' : auction.status === 'upcoming' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
                {auction.status.toUpperCase()}
              </span>
              <span class="ml-2 rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-800">
                {(auction.type || 'PRIVATE').toUpperCase()}
              </span>
            </div>
            <h1 class="text-4xl font-bold text-gray-900 mb-4">{auction.title}</h1>
            <p class="text-gray-600 text-lg mb-6">{auction.description}</p>
            <div class="space-y-3 mb-6">
              <div class="flex items-center text-gray-700">
                <span class="font-semibold mr-2">Auction House:</span>
                <span>{auction.auctionHouse?.name || 'N/A'}</span>
              </div>
              {#if shouldShowCountdown(auction)}
                <div class="flex items-center text-gray-700">
                  <span class="font-semibold mr-2">Starting in:</span>
                  <span class="text-blue-600 font-semibold">
                    <CountdownTimer targetDate={auction.startDate} label="" />
                  </span>
                </div>
              {:else}
                <div class="flex items-center text-gray-700">
                  <span class="font-semibold mr-2">Start Date:</span>
                  <span>{formatDate(auction.startDate)}</span>
                </div>
              {/if}
              <div class="flex items-center text-gray-700">
                <span class="font-semibold mr-2">End Date:</span>
                <span>{formatDate(auction.endDate)}</span>
              </div>
              <div class="flex items-center text-gray-700">
                <span class="font-semibold mr-2">Total Lots:</span>
                <span>{auction.totalLots}</span>
              </div>
              {#if auction.status === 'live'}
                <div class="flex items-center text-red-600">
                  <span class="font-semibold mr-2">Active Bids:</span>
                  <span>{auction.currentBids}</span>
                </div>
              {/if}
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {#if auction.type?.toUpperCase() === 'PUBLIC'}
                <p class="font-semibold text-gray-900">Pumbi public monthly auction</p>
                <p class="mt-1">Open to all account holders. Independent sellers may submit lots for Pumbi approval.</p>
                {#if auction.buyerPremiumRateSnapshot != null}
                  <p class="mt-2"><strong>Buyer premium:</strong> {Number(auction.buyerPremiumRateSnapshot) * 100}%</p>
                {/if}
                <a href="/dashboard/sell" class="mt-3 inline-block font-semibold text-blue-700">Submit an item →</a>
              {:else}
                <p class="font-semibold text-gray-900">Auction-house managed auction</p>
                <p class="mt-1">Anyone may browse. Bidding requires approval from {auction.auctionHouse?.name || 'the auction house'}.</p>
                {#if auction.privateHouseBuyerPremiumRateSnapshot != null}
                  <p class="mt-2"><strong>Buyer premium:</strong> {Number(auction.privateHouseBuyerPremiumRateSnapshot) * 100}%</p>
                {/if}
              {/if}
            </div>
            {#if auction.buyerTermsSnapshot || auction.privateHouseBuyerTermsSnapshot}
              <details class="mt-4 rounded-lg border border-gray-200 p-4">
                <summary class="cursor-pointer font-semibold">Buyer terms</summary>
                <p class="mt-3 whitespace-pre-wrap text-sm text-gray-700">{auction.type?.toUpperCase() === 'PUBLIC' ? auction.buyerTermsSnapshot : auction.privateHouseBuyerTermsSnapshot}</p>
              </details>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Lots Section -->
    <div id="all-lots" class="container mx-auto px-4 py-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-6">Lots ({lots.length})</h2>
      
      {#if lots.length === 0}
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-600">No lots available for this auction yet.</p>
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
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <p class="text-gray-600 text-lg">Auction not found</p>
      <button
        onclick={() => goto('/')}
        class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Back to Auctions
      </button>
    </div>
  </div>
{/if}
