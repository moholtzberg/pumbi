<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import BannerGenerator from '$lib/components/BannerGenerator.svelte';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';

  let auction = $state(null);
  let auctionData = $state({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'UPCOMING',
    imageUrl: ''
  });
  let loading = $state(true);
  let saving = $state(false);
  let savingAuctionData = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  let expandedSections = $state({});

  let settings = $state({
    defaultAuctionDurationDays: 7,
    defaultPreviewPeriodDays: 1,
    autoStartAuctions: false,
    autoCloseAuctions: false,
    staggeredLotClosing: false,
    lotClosingIntervalSeconds: 30,
    requireRegistrationToBid: false,
    allowAbsenteeBids: true,
    extendBiddingOnLastMinuteBid: false,
    biddingExtensionSeconds: 300,
    minimumBidIncrement: 0,
    allowProxyBidding: true,
    maxProxyBidAmount: null,
    defaultAuctionStatus: 'UPCOMING',
    
    // Catalog Settings
    displayStartPriceInCatalog: true,
    enableAbsenteeBids: true,
    buyersPremium: 0,
    daysToAllowPostAuctionSale: null,
    
    // Live Auction Settings
    baseLiveAuctionStartPriceOnAbsenteeBids: false,
    autoAdvanceNextLot: false,
    liveVideoUrl: '',
    liveVideoTitle: '',
    liveAudioUrl: '',
    liveAudioTitle: '',
    
    // Automatic Auction Settings
    automaticAuctionInitialTimerSeconds: null,
    automaticAuctionTimerResetSeconds: null,
    
    // Currency
    currency: 'USD',
    
    // AI Settings
    aiPrompt: '',
    
    // Gallery Template Settings
    galleryTemplate: 'card-grid', // 'card-grid', 'image-slider', 'overlay-text', 'minimal-grid', 'masonry', 'carousel-hover'
    galleryTemplateSettings: {
      // Card Grid settings
      cardGridColumns: 3, // 1-5 columns
      cardGridShowDescription: true,
      cardGridShowStartingBid: true,
      
      // Image Slider settings
      sliderAutoPlay: false,
      sliderAutoPlayInterval: 3000, // milliseconds
      sliderShowDots: true,
      sliderShowArrows: true,
      
      // Overlay Text settings
      overlayTextPosition: 'bottom', // 'top', 'bottom', 'center'
      overlayTextOpacity: 0.8, // 0-1
      overlayButtonStyle: 'white', // 'white', 'colored', 'outline'
      
      // Minimal Grid settings
      minimalGridColumns: 5, // 2-6 columns
      minimalGridShowDescription: false,
      
      // Masonry settings
      masonryColumns: 4, // 2-5 columns
      masonryVaryHeights: true,
    },
  });

  function toggleSection(section) {
    expandedSections[section] = !expandedSections[section];
  }

  onMount(async () => {
    await loadAuction();
  });

  async function loadAuction() {
    try {
      loading = true;
      errorMessage = '';

      const auctionResponse = await fetch(`/api/auctions/${$page.params.id}`);
      if (!auctionResponse.ok) {
        throw new Error('Auction not found');
      }
      auction = await auctionResponse.json();
      
      // Populate auction data for editing
      auctionData = {
        title: auction.title || '',
        description: auction.description || '',
        startDate: auction.startDate ? new Date(auction.startDate).toISOString().slice(0, 16) : '',
        endDate: auction.endDate ? new Date(auction.endDate).toISOString().slice(0, 16) : '',
        status: auction.status || 'UPCOMING',
        imageUrl: auction.imageUrl || ''
      };

      // Load existing settings
      const settingsResponse = await fetch(`/api/auctions/${auction.id}/settings`);
      if (settingsResponse.ok) {
        const existingSettings = await settingsResponse.json();
        // Merge with defaults, preserving existing values
        settings = { ...settings, ...existingSettings };
      }
    } catch (error) {
      console.error('Error loading auction:', error);
      errorMessage = 'Error loading auction data. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    try {
      saving = true;
      errorMessage = '';
      successMessage = '';

      const response = await fetch(`/api/auctions/${auction.id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save settings');
      }

      successMessage = 'Settings saved successfully!';
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      errorMessage = error.message || 'Failed to save settings. Please try again.';
    } finally {
      saving = false;
    }
  }

  async function saveAuctionData() {
    try {
      savingAuctionData = true;
      errorMessage = '';
      successMessage = '';

      // Convert date strings to ISO format
      const startDate = auctionData.startDate ? new Date(auctionData.startDate).toISOString() : null;
      const endDate = auctionData.endDate ? new Date(auctionData.endDate).toISOString() : null;

      const response = await fetch(`/api/auctions/${auction.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: auctionData.title,
          description: auctionData.description,
          startDate: startDate,
          endDate: endDate,
          status: auctionData.status,
          imageUrl: auctionData.imageUrl || null
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save auction data');
      }

      const updated = await response.json();
      auction = updated.auction || updated;
      
      successMessage = 'Auction data saved successfully!';
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error saving auction data:', error);
      errorMessage = error.message || 'Failed to save auction data. Please try again.';
    } finally {
      savingAuctionData = false;
    }
  }
</script>

<svelte:head>
  <title>Auction Settings - {auction?.title || 'Loading...'}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-6">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    {#if loading}
      <div class="text-center py-12">
        <PumbiLoader size="lg" label="Loading auction settings" />
        <p class="mt-4 text-gray-600">Loading auction settings...</p>
      </div>
    {:else if errorMessage && !auction}
      <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p class="text-red-800">{errorMessage}</p>
        <a href="/seller" class="text-blue-600 hover:underline mt-2 inline-block">
          Back to Seller Portal
        </a>
      </div>
    {:else if auction}
      <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold text-white">Auction Settings</h1>
              <div class="mt-2 text-blue-100 text-sm">
                <span class="font-semibold">{auction.title}</span>
                <span class="ml-2 rounded-full bg-white/20 px-2 py-1 text-xs">{(auction.type || 'PRIVATE').toUpperCase()}</span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <a
                href="/seller/auctions/{auction.id}/control-room"
                class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
              >
                Control room
              </a>
              <a
                href="/seller/auctions/{auction.id}/lots"
                class="bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors text-sm font-semibold"
              >
                Manage Lots
              </a>
              {#if (auction.type || 'PRIVATE').toUpperCase() === 'PRIVATE'}
                <a
                  href="/seller/auctions/{auction.id}/bidders"
                  class="bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors text-sm font-semibold"
                >
                  Bidder approvals
                </a>
              {/if}
              <button
                onclick={saveSettings}
                disabled={saving}
                class="bg-white text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {#if errorMessage}
          <div class="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4">
            <p class="text-red-800 text-sm">{errorMessage}</p>
          </div>
        {/if}

        {#if successMessage}
          <div class="bg-green-50 border-l-4 border-green-400 p-4 mx-6 mt-4">
            <p class="text-green-800 text-sm">{successMessage}</p>
          </div>
        {/if}

        <!-- Settings Form -->
        <form onsubmit={(e) => { e.preventDefault(); saveSettings(); }} class="p-6">
          <div class="space-y-4">
            <!-- Auction Information -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('auctionInfo')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Auction Information</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.auctionInfo ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.auctionInfo}
                <div class="p-4 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input 
                      type="text" 
                      bind:value={auctionData.title} 
                      required
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                    />
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      bind:value={auctionData.description} 
                      rows="4"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    ></textarea>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                      <input 
                        type="datetime-local" 
                        bind:value={auctionData.startDate} 
                        required
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      />
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                      <input 
                        type="datetime-local" 
                        bind:value={auctionData.endDate} 
                        required
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      />
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                      <select 
                        bind:value={auctionData.status} 
                        required
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="UPCOMING">Upcoming</option>
                        <option value="LIVE">Live</option>
                        <option value="ENDED">Ended</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                      <input 
                        type="url" 
                        bind:value={auctionData.imageUrl} 
                        placeholder="https://example.com/image.jpg"
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      />
                      {#if auctionData.imageUrl}
                        <div class="mt-2">
                          <img 
                            src={auctionData.imageUrl} 
                            alt="Auction image preview" 
                            class="h-32 w-32 object-cover border border-gray-200 rounded"
                            onerror={(e) => {
                              // If image fails to load (e.g., S3 key), try to get presigned URL
                              if (auctionData.imageUrl && !auctionData.imageUrl.startsWith('http')) {
                                fetch('/api/images/presigned', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ keys: [auctionData.imageUrl] })
                                }).then(async (res) => {
                                  if (res.ok) {
                                    const { urls } = await res.json();
                                    if (urls[auctionData.imageUrl]) {
                                      e.target.src = urls[auctionData.imageUrl];
                                    }
                                  }
                                }).catch(() => {});
                              }
                            }}
                          />
                        </div>
                      {/if}
                    </div>
                  </div>
                  
                  <div class="flex justify-end">
                    <button
                      type="button"
                      onclick={saveAuctionData}
                      disabled={savingAuctionData}
                      class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingAuctionData ? 'Saving...' : 'Save Auction Data'}
                    </button>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Default Auction Settings -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('defaultAuction')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Default Auction Settings</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.defaultAuction ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.defaultAuction}
                <div class="p-4 space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Default Auction Duration (Days)</label>
                      <input type="number" bind:value={settings.defaultAuctionDurationDays} min="1" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <p class="text-xs text-gray-500 mt-1">Default number of days an auction runs</p>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Default Preview Period (Days)</label>
                      <input type="number" bind:value={settings.defaultPreviewPeriodDays} min="0" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <p class="text-xs text-gray-500 mt-1">Preview period before auction starts</p>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Default Auction Status</label>
                      <select bind:value={settings.defaultAuctionStatus} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="UPCOMING">Upcoming</option>
                        <option value="LIVE">Live</option>
                        <option value="ENDED">Ended</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Minimum Bid Increment</label>
                      <input type="number" bind:value={settings.minimumBidIncrement} step="0.01" min="0" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <p class="text-xs text-gray-500 mt-1">Minimum increment for bids (0 = use bid increments table)</p>
                    </div>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Automation Settings -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('automation')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Automation Settings</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.automation ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.automation}
                <div class="p-4 space-y-3">
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.autoStartAuctions} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Auto-start auctions</span>
                      <p class="text-xs text-gray-500">Automatically start auctions at their scheduled start date</p>
                    </div>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.autoCloseAuctions} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Auto-close auctions</span>
                      <p class="text-xs text-gray-500">Automatically close auctions at their scheduled end date</p>
                    </div>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.staggeredLotClosing} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Staggered lot closing</span>
                      <p class="text-xs text-gray-500">Close lots at intervals instead of all at once</p>
                    </div>
                  </label>
                  {#if settings.staggeredLotClosing}
                    <div class="ml-6">
                      <label class="block text-sm font-medium text-gray-700 mb-1">Lot Closing Interval (Seconds)</label>
                      <input type="number" bind:value={settings.lotClosingIntervalSeconds} min="0" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <p class="text-xs text-gray-500 mt-1">Time between closing each lot</p>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Bidding Settings -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('biddingSettings')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Bidding Settings</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.biddingSettings ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.biddingSettings}
                <div class="p-4 space-y-3">
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.requireRegistrationToBid} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Require registration to bid</span>
                      <p class="text-xs text-gray-500">Users must register before placing bids</p>
                    </div>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.allowAbsenteeBids} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Allow absentee bids</span>
                      <p class="text-xs text-gray-500">Users can place bids before auction starts</p>
                    </div>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.allowProxyBidding} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Allow proxy bidding</span>
                      <p class="text-xs text-gray-500">Automatic bidding up to a maximum amount</p>
                    </div>
                  </label>
                  {#if settings.allowProxyBidding}
                    <div class="ml-6">
                      <label class="block text-sm font-medium text-gray-700 mb-1">Max Proxy Bid Amount</label>
                      <input type="number" bind:value={settings.maxProxyBidAmount} step="0.01" min="0" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <p class="text-xs text-gray-500 mt-1">Maximum amount for proxy bids (leave empty for unlimited)</p>
                    </div>
                  {/if}
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.extendBiddingOnLastMinuteBid} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Extend bidding on last minute bid</span>
                      <p class="text-xs text-gray-500">Automatically extend auction if bid placed near closing time</p>
                    </div>
                  </label>
                  {#if settings.extendBiddingOnLastMinuteBid}
                    <div class="ml-6">
                      <label class="block text-sm font-medium text-gray-700 mb-1">Bidding Extension (Seconds)</label>
                      <input type="number" bind:value={settings.biddingExtensionSeconds} min="0" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <p class="text-xs text-gray-500 mt-1">How long to extend bidding when last-minute bid is placed</p>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Catalog Settings -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('catalog')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Catalog</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.catalog ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.catalog}
                <div class="p-4 space-y-4">
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.displayStartPriceInCatalog} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <span class="text-sm font-medium text-gray-700">Display start price in catalog</span>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.enableAbsenteeBids} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <span class="text-sm font-medium text-gray-700">Enable absentee bids</span>
                  </label>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Buyer's Premium (%)</label>
                      <input type="number" bind:value={settings.buyersPremium} step="0.01" min="0" max="100" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Days to allow post auction sale</label>
                      <input type="number" bind:value={settings.daysToAllowPostAuctionSale} min="0" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Live Auction Settings -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('liveAuction')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Live Auction</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.liveAuction ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.liveAuction}
                <div class="p-4 space-y-4">
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={settings.baseLiveAuctionStartPriceOnAbsenteeBids} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Base live auction start price on absentee bids</span>
                      <p class="text-xs text-gray-500">(Timed Auctions Only)</p>
                    </div>
                  </label>
                  <label class="flex items-start">
                    <input type="checkbox" bind:checked={settings.autoAdvanceNextLot} class="mt-0.5 mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <div>
                      <span class="text-sm font-medium text-gray-700">Auto-advance to the next lot</span>
                      <p class="text-xs text-gray-500">After a lot is hammered / finished, automatically put the next ready lot on the block. You can also toggle this live in the control room.</p>
                    </div>
                  </label>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Floor auction live video URL</label>
                    <input type="url" bind:value={settings.liveVideoUrl} placeholder="https://www.youtube.com/watch?v=…" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    <p class="mt-1 text-xs text-gray-500">Optional. YouTube, Vimeo, or a provider's embeddable HTTPS player URL.</p>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Video title</label>
                    <input type="text" maxlength="120" bind:value={settings.liveVideoTitle} placeholder="Live from the auction floor" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div class="border-t border-gray-200 pt-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Live audio feed URL</label>
                    <input type="url" bind:value={settings.liveAudioUrl} placeholder="https://stream.example.com/auction.mp3" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    <p class="mt-1 text-xs text-gray-500">Optional HTTPS audio stream. Every bidder can listen from the public live auction room.</p>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Audio feed title</label>
                    <input type="text" maxlength="120" bind:value={settings.liveAudioTitle} placeholder="Listen to the auctioneer" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>
              {/if}
            </div>

            <!-- Automatic Auction Settings -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('automaticAuction')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Automatic Auction</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.automaticAuction ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.automaticAuction}
                <div class="p-4 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Default time on block (seconds)</label>
                    <input type="number" bind:value={settings.automaticAuctionInitialTimerSeconds} min="1" placeholder="Inherited (platform default: 60)" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    <p class="mt-1 text-xs text-gray-500">Leave blank to inherit the auction-house default.</p>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Bid refresh threshold (seconds)</label>
                    <input type="number" bind:value={settings.automaticAuctionTimerResetSeconds} min="1" placeholder="Inherited (platform default: 30)" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    <p class="mt-1 text-xs text-gray-500">When a new highest bid arrives with less time remaining, the timer resets to this value.</p>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Gallery Template Settings -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('galleryTemplate')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Gallery Template</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.galleryTemplate ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.galleryTemplate}
                <div class="p-4 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Template</label>
                    <select bind:value={settings.galleryTemplate} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="card-grid">Card Grid - Traditional card layout</option>
                      <option value="image-slider">Image Slider - Carousel with multiple images</option>
                      <option value="overlay-text">Overlay Text - Full image with text overlay</option>
                      <option value="minimal-grid">Minimal Grid - Clean minimal design</option>
                      <option value="masonry">Masonry - Pinterest-style layout</option>
                      <option value="carousel-hover">Carousel Hover - Natural aspect ratio with content on hover</option>
                    </select>
                    <p class="text-xs text-gray-500 mt-1">Choose how lots are displayed in the gallery</p>
                  </div>
                  
                  <!-- Template-specific settings -->
                  {#if settings.galleryTemplate === 'card-grid'}
                    <div class="border-t pt-4 space-y-3">
                      <h4 class="text-sm font-semibold text-gray-900">Card Grid Settings</h4>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Columns</label>
                        <input type="number" bind:value={settings.galleryTemplateSettings.cardGridColumns} min="1" max="5" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={settings.galleryTemplateSettings.cardGridShowDescription} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span class="text-sm text-gray-700">Show description</span>
                      </label>
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={settings.galleryTemplateSettings.cardGridShowStartingBid} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span class="text-sm text-gray-700">Show starting bid</span>
                      </label>
                    </div>
                  {:else if settings.galleryTemplate === 'image-slider'}
                    <div class="border-t pt-4 space-y-3">
                      <h4 class="text-sm font-semibold text-gray-900">Image Slider Settings</h4>
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={settings.galleryTemplateSettings.sliderAutoPlay} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span class="text-sm text-gray-700">Auto-play slideshow</span>
                      </label>
                      {#if settings.galleryTemplateSettings.sliderAutoPlay}
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Auto-play Interval (ms)</label>
                          <input type="number" bind:value={settings.galleryTemplateSettings.sliderAutoPlayInterval} min="1000" step="500" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                      {/if}
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={settings.galleryTemplateSettings.sliderShowDots} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span class="text-sm text-gray-700">Show navigation dots</span>
                      </label>
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={settings.galleryTemplateSettings.sliderShowArrows} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span class="text-sm text-gray-700">Show arrow buttons</span>
                      </label>
                    </div>
                  {:else if settings.galleryTemplate === 'overlay-text'}
                    <div class="border-t pt-4 space-y-3">
                      <h4 class="text-sm font-semibold text-gray-900">Overlay Text Settings</h4>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Text Position</label>
                        <select bind:value={settings.galleryTemplateSettings.overlayTextPosition} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="top">Top</option>
                          <option value="center">Center</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Overlay Opacity: {Math.round(settings.galleryTemplateSettings.overlayTextOpacity * 100)}%</label>
                        <input type="range" bind:value={settings.galleryTemplateSettings.overlayTextOpacity} min="0" max="1" step="0.1" class="w-full" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Button Style</label>
                        <select bind:value={settings.galleryTemplateSettings.overlayButtonStyle} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="white">White</option>
                          <option value="colored">Colored</option>
                          <option value="outline">Outline</option>
                        </select>
                      </div>
                    </div>
                  {:else if settings.galleryTemplate === 'minimal-grid'}
                    <div class="border-t pt-4 space-y-3">
                      <h4 class="text-sm font-semibold text-gray-900">Minimal Grid Settings</h4>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Columns</label>
                        <input type="number" bind:value={settings.galleryTemplateSettings.minimalGridColumns} min="2" max="6" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={settings.galleryTemplateSettings.minimalGridShowDescription} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span class="text-sm text-gray-700">Show description</span>
                      </label>
                    </div>
                  {:else if settings.galleryTemplate === 'masonry'}
                    <div class="border-t pt-4 space-y-3">
                      <h4 class="text-sm font-semibold text-gray-900">Masonry Settings</h4>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Columns</label>
                        <input type="number" bind:value={settings.galleryTemplateSettings.masonryColumns} min="2" max="5" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={settings.galleryTemplateSettings.masonryVaryHeights} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span class="text-sm text-gray-700">Vary image heights</span>
                      </label>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Currency -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('currency')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Currency</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.currency ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.currency}
                <div class="p-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select bind:value={settings.currency} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="ILS">ILS - Israeli Shekel</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="CHF">CHF - Swiss Franc</option>
                  </select>
                </div>
              {/if}
            </div>

            <!-- AI Settings -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('ai')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">AI Settings</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.ai ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.ai}
                <div class="p-4 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      AI Prompt (for this auction)
                    </label>
                    <textarea
                      bind:value={settings.aiPrompt}
                      rows="4"
                      placeholder="Enter additional context, tone, or style guidelines for AI-generated content. This will be combined with the auction house AI prompt."
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-1">
                      This prompt will be added to AI requests for generating titles, descriptions, and summarizing notes for lots in this auction.
                    </p>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Banner Generator -->
            <div class="border border-gray-200 rounded-lg">
              <button
                type="button"
                onclick={() => toggleSection('banner')}
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="font-medium text-gray-900">Banner Generator</span>
                <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.banner ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {#if expandedSections.banner}
                <div class="p-4">
                  <BannerGenerator 
                    type="auction" 
                    {auction}
                    auctionHouse={auction?.auctionHouse || null}
                    onSave={(bannerUrl) => {
                      // Save banner URL to auction settings
                      if (settings) {
                        settings.bannerUrl = bannerUrl;
                        saveSettings();
                      }
                    }}
                  />
                </div>
              {/if}
            </div>
          </div>
        </form>
      </div>
    {/if}
  </div>
</div>
