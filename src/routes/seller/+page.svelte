<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getImageUrl } from '$lib/utils/imageUrl.js';
  
  let {
    data
  } = $props();
  
  // Session is passed from layout via slot props
  let session = $state(data?.session);
  let currentUser = $state(null);
  let auctionHouse = $state(null);
  let auctionHouseLogoUrl = $state(null);
  let myAuctions = $state([]);
  let loading = $state(true);
  let showCreateModal = $state(false);
  let errorMessage = $state('');
  
  let newAuction = $state({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    imageUrl: '',
    status: 'UPCOMING',
    type: 'PRIVATE'
  });
  
  onMount(async () => {
    // Session is already checked server-side, but verify client-side as well
    if (!session?.user) {
      goto('/auth/login');
      return;
    }
    await loadUserData();
  });
  
  async function loadUserData() {
    try {
      loading = true;
      errorMessage = '';
      
      // Get or create user in our database
      let userResponse = await fetch(`/api/users?email=${encodeURIComponent(session.user.email)}`);
      if (!userResponse.ok) {
        // User doesn't exist in our DB yet
        errorMessage = 'User account not found. Please register an auction house first.';
        loading = false;
        return;
      }
      currentUser = await userResponse.json();
      
      // Check if user has an auction house
      if (!currentUser.auctionHouseId) {
        errorMessage = 'You need to register an auction house first.';
        loading = false;
        return;
      }
      
      // Load auction house by ID
      const auctionHouseResponse = await fetch(`/api/auction-houses?id=${currentUser.auctionHouseId}`);
      if (auctionHouseResponse.ok) {
        auctionHouse = await auctionHouseResponse.json();
        // Convert logo URL to presigned URL if it's an S3 key
        if (auctionHouse?.logoUrl) {
          auctionHouseLogoUrl = await getImageUrl(auctionHouse.logoUrl);
        }
      }
      
      // Load auctions for this auction house
      await loadAuctions();
    } catch (error) {
      console.error('Error loading user data:', error);
      errorMessage = 'Error loading your account data. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  async function loadAuctions() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3c92fc5f-a28e-4692-89ad-7cb9d7bd10c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'seller/+page.svelte:80',message:'loadAuctions entry',data:{hasAuctionHouseId:!!currentUser?.auctionHouseId,auctionHouseId:currentUser?.auctionHouseId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    try {
      if (!currentUser?.auctionHouseId) {
        console.log('No auctionHouseId for user:', currentUser);
        myAuctions = [];
        return;
      }
      
      console.log('Loading auctions for auctionHouseId:', currentUser.auctionHouseId);
      const response = await fetch(`/api/auctions?auctionHouseId=${currentUser.auctionHouseId}`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3c92fc5f-a28e-4692-89ad-7cb9d7bd10c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'seller/+page.svelte:89',message:'After fetch',data:{ok:response.ok,status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to load auctions:', response.status, response.statusText, errorText);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3c92fc5f-a28e-4692-89ad-7cb9d7bd10c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'seller/+page.svelte:92',message:'Response not ok',data:{status:response.status,errorText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        myAuctions = [];
        return;
      }
      
      const auctions = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3c92fc5f-a28e-4692-89ad-7cb9d7bd10c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'seller/+page.svelte:98',message:'After JSON parse',data:{auctionsType:typeof auctions,isArray:Array.isArray(auctions),hasError:!!auctions.error,length:auctions?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.log('Raw auctions response:', auctions);
      
      // Check if response is an error object
      if (auctions.error) {
        console.error('API error:', auctions.error);
        myAuctions = [];
        return;
      }
      
      // Ensure auctions is an array
      if (!Array.isArray(auctions)) {
        console.error('Auctions is not an array:', auctions);
        myAuctions = [];
        return;
      }
      
      console.log('Total auctions found:', auctions.length);
      console.log('Current user ID:', currentUser.id);
      console.log('Current user role:', currentUser.role);
      
      // Show all auctions for the auction house (not just this user's)
      // This allows users to see all auctions in their auction house
      myAuctions = auctions;
      
      console.log('Displaying auctions:', myAuctions.length);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3c92fc5f-a28e-4692-89ad-7cb9d7bd10c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'seller/+page.svelte:123',message:'Before setting myAuctions',data:{myAuctionsLength:myAuctions.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      // Load lot counts for each auction
      for (const auction of myAuctions) {
        try {
          const lotsResponse = await fetch(`/api/lots?auctionId=${auction.id}`);
          if (lotsResponse.ok) {
            const lots = await lotsResponse.json();
            auction.totalLots = Array.isArray(lots) ? lots.length : 0;
            auction.currentBids = Array.isArray(lots) ? lots.reduce((sum, lot) => sum + (lot.bids?.length || 0), 0) : 0;
          }
        } catch (error) {
          console.error(`Error loading lots for auction ${auction.id}:`, error);
          auction.totalLots = 0;
          auction.currentBids = 0;
        }
      }
      
      console.log('Final myAuctions:', myAuctions);
    } catch (error) {
      console.error('Error loading auctions:', error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3c92fc5f-a28e-4692-89ad-7cb9d7bd10c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'seller/+page.svelte:127',message:'Error in loadAuctions',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      myAuctions = [];
    }
  }
  
  async function createAuction() {
    try {
      if (!currentUser?.auctionHouseId) {
        errorMessage = 'You must be linked to an auction house to create auctions.';
        return;
      }
      
      // Convert date strings to ISO format
      const startDate = newAuction.startDate ? new Date(newAuction.startDate).toISOString() : new Date().toISOString();
      const endDate = newAuction.endDate ? new Date(newAuction.endDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await fetch('/api/auctions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newAuction.title,
          description: newAuction.description || null,
          startDate: startDate,
          endDate: endDate,
          imageUrl: newAuction.imageUrl || null,
          status: newAuction.status.toUpperCase(),
          type: 'PRIVATE',
          auctionHouseId: currentUser.auctionHouseId,
          sellerId: currentUser.id
        })
      });
      
      if (response.ok) {
        showCreateModal = false;
        newAuction = {
          title: '',
          description: '',
          startDate: '',
          endDate: '',
          imageUrl: '',
          status: 'UPCOMING',
          type: 'PRIVATE'
        };
        await loadAuctions();
      } else {
        const error = await response.json();
        errorMessage = error.message || 'Failed to create auction. Please try again.';
      }
    } catch (error) {
      console.error('Error creating auction:', error);
      errorMessage = 'An error occurred while creating the auction. Please try again.';
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
    const statusUpper = status?.toUpperCase();
    switch (statusUpper) {
      case 'LIVE':
        return 'bg-red-100 text-red-800';
      case 'UPCOMING':
        return 'bg-blue-100 text-blue-800';
      case 'ENDED':
        return 'bg-gray-100 text-gray-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    {#if errorMessage}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div class="flex items-center justify-between">
          <p class="text-red-800">{errorMessage}</p>
          {#if errorMessage.includes('register an auction house')}
            <a href="/auction-houses/signup" class="text-blue-600 hover:text-blue-800 font-semibold">
              Register Now →
            </a>
          {/if}
        </div>
      </div>
    {/if}
    
    {#if auctionHouse}
      <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">{auctionHouse.name}</h2>
            {#if auctionHouse.description}
              <p class="text-gray-600 mt-1">{auctionHouse.description}</p>
            {/if}
          </div>
          {#if auctionHouseLogoUrl}
            <img src={auctionHouseLogoUrl} alt={auctionHouse.name} class="h-16 w-16 object-contain" />
          {/if}
        </div>
      </div>
    {/if}
    
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold text-gray-900">Auction Management</h1>
        <p class="text-gray-600 mt-2">Create and manage your auctions</p>
      </div>
      <div class="flex items-center gap-4">
        {#if currentUser?.auctionHouseId}
          <a
            href="/seller/settings"
            class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-semibold"
          >
            Settings
          </a>
          <button
            onclick={() => showCreateModal = true}
            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Create New Auction
          </button>
        {/if}
      </div>
    </div>

    {#if loading}
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading auctions...</p>
      </div>
    {:else if myAuctions.length === 0}
      <div class="bg-white rounded-lg shadow-lg p-12 text-center">
        <p class="text-gray-600 text-lg mb-4">You haven't created any auctions yet.</p>
        <button
          onclick={() => showCreateModal = true}
          class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          Create Your First Auction
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each myAuctions as auction}
          <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
            <div class="relative">
              <img
                src={auction.imageUrl}
                alt={auction.title}
                class="w-full h-48 object-cover"
              />
              <span class="absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-semibold {getStatusBadgeClass(auction.status)}">
                {auction.status?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            <div class="p-6">
              <h3 class="text-xl font-bold text-gray-900 mb-2">{auction.title}</h3>
              <span class="mb-3 inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-bold text-purple-800">
                {(auction.type || 'PRIVATE').toUpperCase()} auction
              </span>
              <p class="text-gray-600 text-sm mb-4 line-clamp-2">{auction.description}</p>
              <div class="space-y-2 mb-4 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500">Lots:</span>
                  <span class="font-semibold">{auction.totalLots}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Bids:</span>
                  <span class="font-semibold">{auction.currentBids}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Starts:</span>
                  <span class="font-semibold">{formatDate(auction.startDate)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Ends:</span>
                  <span class="font-semibold">{formatDate(auction.endDate)}</span>
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  onclick={() => goto(`/auctions/${auction.id}`)}
                  class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                >
                  View
                </button>
                <button
                  onclick={() => goto(`/seller/auctions/${auction.id}/lots`)}
                  class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors font-semibold text-sm"
                >
                  Manage Lots
                </button>
                <button
                  onclick={() => goto(`/seller/auctions/${auction.id}/settings`)}
                  class="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors font-semibold text-sm"
                >
                  Settings
                </button>
                {#if (auction.type || 'PRIVATE').toUpperCase() === 'PRIVATE'}
                  <button
                    onclick={() => goto(`/seller/auctions/${auction.id}/bidders`)}
                    class="flex-1 bg-green-700 text-white py-2 rounded-lg hover:bg-green-800 transition-colors font-semibold text-sm"
                  >
                    Bidders
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Create Auction Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Create New Auction</h2>
          <button
            onclick={() => showCreateModal = false}
            class="text-gray-500 hover:text-gray-700"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); createAuction(); }}>
          <div class="space-y-4">
            <div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <p class="font-semibold text-purple-900">Private auction</p>
              <p class="mt-1 text-sm text-purple-800">Your auction house controls every lot, its rates and terms, and which registered bidders are approved.</p>
            </div>
            <div>
              <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
                Auction Title *
              </label>
              <input
                id="title"
                type="text"
                bind:value={newAuction.title}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Fine Art & Collectibles Auction"
              />
            </div>

            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                bind:value={newAuction.description}
                required
                rows="4"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe your auction..."
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="startDate" class="block text-sm font-medium text-gray-700 mb-2">
                  Start Date *
                </label>
                <input
                  id="startDate"
                  type="datetime-local"
                  bind:value={newAuction.startDate}
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label for="endDate" class="block text-sm font-medium text-gray-700 mb-2">
                  End Date *
                </label>
                <input
                  id="endDate"
                  type="datetime-local"
                  bind:value={newAuction.endDate}
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label for="imageUrl" class="block text-sm font-medium text-gray-700 mb-2">
                Image URL *
              </label>
              <input
                id="imageUrl"
                type="url"
                bind:value={newAuction.imageUrl}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label for="status" class="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                id="status"
                bind:value={newAuction.status}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="UPCOMING">Upcoming</option>
                <option value="LIVE">Live</option>
                <option value="ENDED">Ended</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div class="flex gap-4 mt-6">
            <button
              type="button"
              onclick={() => showCreateModal = false}
              class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Create Auction
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

