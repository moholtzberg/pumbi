<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';
  
  let auctions = $state([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let statusFilter = $state('all');
  
  $effect(async () => {
    await loadAuctions();
  });
  
  async function loadAuctions() {
    try {
      loading = true;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const url = `/api/auctions?${params.toString()}`;
      const response = await fetch(url);
      auctions = await response.json();
    } catch (error) {
      console.error('Error loading auctions:', error);
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
  
  function getStatusBadgeClass(status) {
    switch (status) {
      case 'live':
        return 'bg-red-100 text-red-800';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'ended':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
  
  function filteredAuctions() {
    if (!searchQuery) return auctions;
    const query = searchQuery.toLowerCase();
    return auctions.filter(auction => 
      auction.title.toLowerCase().includes(query) ||
      auction.description.toLowerCase().includes(query) ||
      auction.sellerName.toLowerCase().includes(query)
    );
  }
  
  function shouldShowCountdown(auction) {
    if (!auction.startDate || auction.status !== 'upcoming') return false;
    const startDate = new Date(auction.startDate);
    const now = new Date();
    const daysUntilStart = (startDate - now) / (1000 * 60 * 60 * 24);
    return daysUntilStart > 0 && daysUntilStart <= 30;
  }
  
  $effect(() => {
    loadAuctions();
  });
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Hero Section -->
  <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
    <div class="container mx-auto px-4">
      <h1 class="text-4xl md:text-5xl font-bold mb-4">Welcome to Pumbi</h1>
      <p class="text-xl mb-2">Your premier destination for Judaica auctions</p>
      <p class="text-lg mb-8 opacity-90">Discover rare menorahs, Torah scrolls, ceremonial silver, and authentic Jewish artifacts</p>
      
      <!-- Search Bar -->
      <div class="max-w-2xl">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search Judaica auctions, lots, or sellers..."
          class="w-full px-6 py-4 rounded-lg text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-white"
        />
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="container mx-auto px-4 py-6">
    <div class="flex flex-wrap gap-4 items-center mb-6">
      <span class="font-semibold text-gray-700">Filter by status:</span>
      <button
        onclick={() => { statusFilter = 'all'; loadAuctions(); }}
        class="px-4 py-2 rounded-lg transition-colors {statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
      >
        All
      </button>
      <button
        onclick={() => { statusFilter = 'live'; loadAuctions(); }}
        class="px-4 py-2 rounded-lg transition-colors {statusFilter === 'live' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
      >
        Live Now
      </button>
      <button
        onclick={() => { statusFilter = 'upcoming'; loadAuctions(); }}
        class="px-4 py-2 rounded-lg transition-colors {statusFilter === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
      >
        Upcoming
      </button>
      <button
        onclick={() => { statusFilter = 'ended'; loadAuctions(); }}
        class="px-4 py-2 rounded-lg transition-colors {statusFilter === 'ended' ? 'bg-gray-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
      >
        Ended
      </button>
    </div>

    <!-- Auctions Grid -->
    {#if loading}
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading auctions...</p>
      </div>
    {:else if filteredAuctions().length === 0}
      <div class="text-center py-12">
        <p class="text-gray-600 text-lg">No auctions found. Try adjusting your filters.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each filteredAuctions() as auction}
          <div
            onclick={() => goto(`/auctions/${auction.id}`)}
            class="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
          >
            <div class="relative">
              <img
                src={auction.imageUrl}
                alt={auction.title}
                class="w-full h-48 object-cover"
              />
              <span class="absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-semibold {getStatusBadgeClass(auction.status)}">
                {auction.status.toUpperCase()}
              </span>
            </div>
            <div class="p-6">
              <h3 class="text-xl font-bold text-gray-900 mb-2">{auction.title}</h3>
              <p class="text-gray-600 text-sm mb-4 line-clamp-2">{auction.description}</p>
              <div class="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>By {auction.auctionHouse?.name || 'N/A'}</span>
                <span>{auction.totalLots} lots</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <div>
                  {#if shouldShowCountdown(auction)}
                    <CountdownTimer targetDate={auction.startDate} label="Starting in" />
                  {:else}
                    <p class="text-gray-500">Starts</p>
                    <p class="font-semibold">{formatDate(auction.startDate)}</p>
                  {/if}
                </div>
                <div class="text-right">
                  <p class="text-gray-500">Ends</p>
                  <p class="font-semibold">{formatDate(auction.endDate)}</p>
                </div>
              </div>
              {#if auction.status === 'live'}
                <div class="mt-4 pt-4 border-t">
                  <p class="text-sm text-gray-600">{auction.currentBids} active bids</p>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
