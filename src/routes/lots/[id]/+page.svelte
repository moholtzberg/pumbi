<script>
  import { requiresBidderRegistration } from '$lib/utils/biddingAccess.js';
  import MaximumBidForm from '$lib/components/MaximumBidForm.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';
  import InterestTracker from '$lib/components/InterestTracker.svelte';
  import AuctionActivity from '$lib/components/AuctionActivity.svelte';
  
  let lot = $state(null);
  let bids = $state([]);
  let loading = $state(true);
  let bidError = $state('');
  let session = $state(null);
  let currentUser = $state(null);
  let auctionSettings = $state(null);
  let isRegistered = $state(false);
  let bidAccess = $state(null);
  let registrationRequired = $derived(requiresBidderRegistration(lot?.auction));
  let registrationStatus = $state('NONE');
  let acceptTerms = $state(false);
  let checkingRegistration = $state(false);
  let registering = $state(false);
  let isWatching = $state(false);
  let watchBusy = $state(false);
  let watchError = $state('');
  
  let pollInterval = null;
  
  $effect(() => {
    if ($page.params.id) {
      loadSession();
      loadLot();
      // Poll for updates every 5 seconds
      pollInterval = setInterval(() => {
        loadLot();
        loadBids();
      }, 5000);
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  });
  
  async function loadSession() {
    try {
      const res = await fetch('/auth/session', { credentials: 'include' });
      if (res.ok) {
        session = await res.json();
        if (session?.user) {
          await loadUserData();
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }
  
  async function loadUserData() {
    try {
      // Get or create user in our database
      let userResponse = await fetch(`/api/users?email=${encodeURIComponent(session.user.email)}`, {
        credentials: 'include'
      });
      if (!userResponse.ok) {
        // User doesn't exist in our DB yet - create them
        userResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: session.user.email,
            name: session.user.name || `${session.user.first_name || ''} ${session.user.last_name || ''}`.trim(),
            firstName: session.user.first_name || null,
            lastName: session.user.last_name || null,
            role: 'BUYER'
          })
        });
      }
      currentUser = await userResponse.json();
      await loadWatchState();
      if (lot?.auctionId) await checkRegistration();
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  async function loadWatchState() {
    if (!currentUser || !$page.params.id) return;
    try {
      const response = await fetch(`/api/lots/${$page.params.id}/watch`, { credentials: 'include' });
      if (response.ok) isWatching = (await response.json()).watching;
    } catch (error) {
      console.error('Error loading watch status:', error);
    }
  }

  async function toggleWatch() {
    if (!session?.user || !currentUser) {
      goto(`/auth/login?redirect=${encodeURIComponent($page.url.pathname)}`);
      return;
    }
    watchBusy = true;
    watchError = '';
    try {
      const response = await fetch(`/api/lots/${lot.id}/watch`, {
        method: isWatching ? 'DELETE' : 'POST',
        credentials: 'include'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Could not update your watchlist');
      isWatching = result.watching;
      lot.watchersCount = result.watchersCount;
    } catch (error) {
      watchError = error.message;
    } finally {
      watchBusy = false;
    }
  }
  
  async function loadLot() {
    try {
      const response = await fetch(`/api/lots/${$page.params.id}`);
      lot = await response.json();
      if (lot) {
        // Load auction settings
        await loadAuctionSettings();
        // Check registration status if user is logged in
        if (currentUser && lot.auctionId) {
          await checkRegistration();
        }
      }
    } catch (error) {
      console.error('Error loading lot:', error);
    } finally {
      loading = false;
    }
  }
  
  async function loadAuctionSettings() {
    if (!lot?.auctionId) return;
    try {
      const response = await fetch(`/api/auctions/${lot.auctionId}/settings`, {
        credentials: 'include'
      });
      if (response.ok) {
        const settings = await response.json();
        auctionSettings = settings;
      }
    } catch (error) {
      console.error('Error loading auction settings:', error);
    }
  }
  
  async function checkRegistration() {
    if (!lot?.auctionId || !currentUser) return;
    try {
      checkingRegistration = true;
      const response = await fetch(`/api/auctions/${lot.auctionId}/register`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        registrationStatus = data.status || (data.registered ? 'APPROVED' : 'NONE');
        bidAccess = data;
        isRegistered = Boolean(data.readyToBid);
      }
    } catch (error) {
      console.error('Error checking registration:', error);
    } finally {
      checkingRegistration = false;
    }
  }
  
  async function registerForAuction() {
    if (!lot?.auctionId || !currentUser) return;
    try {
      registering = true;
      const response = await fetch(`/api/auctions/${lot.auctionId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acceptedTerms: acceptTerms })
      });
      if (response.ok) {
        const result = await response.json();
        registrationStatus = result.status || (result.registered ? 'APPROVED' : 'PENDING');
        await checkRegistration();
      } else {
        const error = await response.json();
        bidError = error.message || 'Failed to register for auction';
      }
    } catch (error) {
      console.error('Error registering for auction:', error);
      bidError = 'Failed to register for auction';
    } finally {
      registering = false;
    }
  }
  
  async function loadBids() {
    try {
      const response = await fetch(`/api/bids?lotId=${$page.params.id}`);
      bids = await response.json();
    } catch (error) {
      console.error('Error loading bids:', error);
    }
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  
  function formatDate(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function conditionForLot(item) {
    try {
      return item?.metaFields ? JSON.parse(item.metaFields).condition || '' : '';
    } catch {
      return '';
    }
  }
  
  onMount(() => {
    loadBids();
  });
</script>

{#if loading}
  <div class="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
    <div class="text-center">
      <PumbiLoader size="lg" label="Loading lot" />
      <p class="mt-4 text-gray-600">Loading lot...</p>
    </div>
  </div>
{:else if lot}
  <InterestTracker entityType="LOT" entityId={lot.id} />
  <div class="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8"><AuctionActivity auctionId={lot.auctionId} lotId={lot.id} /></div>
  <div class="min-h-screen bg-[#f7f4ee]">
    <div class="container mx-auto px-4 py-8">
      <button
        onclick={() => goto(`/auctions/${lot.auctionId}`)}
        class="text-[#18372f] hover:text-[#18372f] mb-6 flex items-center"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Auction
      </button>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
            <div class="relative">
              <img
                src={lot.imageUrl}
                alt={lot.title}
                class="w-full h-96 object-cover"
              />
              <div class="absolute top-4 left-4 bg-white px-4 py-2 rounded-sm text-lg font-bold">
                Lot #{lot.lotNumber}
              </div>
            </div>
            <div class="p-8">
              <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
                <h1 class="text-3xl font-bold text-gray-900">{lot.title}</h1>
                <button
                  type="button"
                  onclick={toggleWatch}
                  disabled={watchBusy}
                  aria-pressed={isWatching}
                  class="inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-bold transition disabled:opacity-50 {isWatching ? 'border-[#ddd6ca] bg-[#efe8dc] text-[#18372f]' : 'border-gray-200 bg-white text-gray-700 hover:border-[#c4b8a8] hover:text-[#18372f]'}"
                >
                  <span aria-hidden="true">{isWatching ? '♥' : '♡'}</span>
                  {watchBusy ? 'Updating…' : isWatching ? 'Watching' : 'Watch lot'}
                </button>
              </div>
              {#if watchError}<p class="mb-4 text-sm font-medium text-red-600">{watchError}</p>{/if}
              {#if isWatching}<p class="mb-4 text-xs text-gray-500">When this house enables reminders, we’ll email your verified address as this lot approaches the block. Each email includes an unsubscribe link.</p>{/if}
              <p class="text-gray-600 text-lg mb-6">{lot.description}</p>
              {#if conditionForLot(lot)}
                <div class="mb-6 rounded-sm border border-amber-200 bg-amber-50 p-4">
                  <p class="text-xs font-bold uppercase tracking-wide text-amber-700">Condition</p>
                  <p class="mt-1 text-sm leading-6 text-amber-950">{conditionForLot(lot)}</p>
                </div>
              {/if}
              
              <div class="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p class="text-sm text-gray-500 mb-1">Starting Bid</p>
                  <p class="text-2xl font-bold text-gray-900">{formatCurrency(lot.startingBid)}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500 mb-1">Bid Increment</p>
                  <p class="text-2xl font-bold text-gray-900">{formatCurrency(lot.bidIncrement)}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Bidding History -->
          <div class="bg-white rounded-lg shadow-lg p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Bidding History</h2>
            {#if bids.length === 0}
              <p class="text-gray-600">No bids yet. Be the first to bid!</p>
            {:else}
              <div class="space-y-4">
                {#each bids as bid}
                  <div class="flex items-center justify-between p-4 bg-[#f7f4ee] rounded-lg">
                    <div>
                      <p class="font-semibold text-gray-900">{bid.userName}{#if bid.isAutomatic}<span class="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800">Auto</span>{/if}{#if bid.source === 'PHONE'}<span class="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">Phone</span>{/if}</p>
                      <p class="text-sm text-gray-500">{formatDate(bid.timestamp)}</p>
                    </div>
                    <p class="text-xl font-bold text-[#18372f]">{formatCurrency(bid.amount)}</p>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Bidding Panel -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow-lg p-6 sticky top-4">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Place Your Bid</h2>
            
            <div class="mb-6">
              <p class="text-sm text-gray-500 mb-2">Current Highest Bid</p>
              <p class="text-4xl font-bold text-[#18372f] mb-4">{formatCurrency(lot.currentBid)}</p>
              
              {#if currentUser && lot.highestBidderId === currentUser.id}
                <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                  <p class="font-semibold">You are the highest bidder!</p>
                </div>
              {:else if lot.highestBidderName}
                <p class="text-sm text-gray-600">Highest bidder: {lot.highestBidderName}</p>
              {/if}
            </div>

            {#if bidError}<p role="alert" class="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{bidError}</p>{/if}
            {#if !session?.user || !currentUser}
              <div class="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p class="text-sm text-yellow-800 mb-4">You must be logged in to place a bid.</p>
                <a
                  href="/auth/login?redirect={encodeURIComponent($page.url.pathname)}"
                  class="inline-block bg-[#18372f] text-white px-4 py-2 rounded-lg hover:bg-[#152c26] transition-colors"
                >
                  Login to Bid
                </a>
              </div>
            {:else if registrationRequired && !isRegistered}
              <div class="mb-6 bg-[#efe8dc] border border-[#ddd6ca] rounded-lg p-4">
                {#if bidAccess?.needsVerification}
                  <p class="font-semibold text-amber-900">Finish buyer verification before registering for this auction.</p>
                  <a href="/dashboard/verification" class="mt-3 inline-block font-bold text-[#18372f] underline">Continue verification</a>
                {:else if registrationStatus === 'PENDING'}
                  <p class="font-semibold text-[#152c26]">Approval pending</p>
                  <p class="mt-1 text-sm text-[#18372f]">The auction house will review your bidder registration.</p>
                {:else if registrationStatus === 'REJECTED'}
                  <p class="font-semibold text-red-900">Registration not approved</p>
                  <p class="mt-1 text-sm text-red-800">Contact the auction organizer if you need more information.</p>
                {:else}
                  <p class="text-sm text-[#18372f] mb-2 font-semibold">{lot.auction?.type?.toUpperCase() === 'PRIVATE' ? 'Bidder approval required' : 'Accept Pumbi terms to bid'}</p>
                  <p class="text-sm text-[#18372f] mb-4">{lot.auction?.type?.toUpperCase() === 'PRIVATE' ? 'Submit your registration for approval by the auction house.' : 'This public auction is open to all account holders.'}</p>
                  <label class="mb-4 flex items-start gap-2 text-sm text-[#152c26]">
                    <input type="checkbox" bind:checked={acceptTerms} class="mt-1" />
                    <span>I accept the applicable buyer terms and rates for this auction.</span>
                  </label>
                  <button
                    onclick={registerForAuction}
                    disabled={registering || !acceptTerms}
                    class="inline-block bg-[#18372f] text-white px-4 py-2 rounded-lg hover:bg-[#152c26] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registering ? 'Submitting...' : lot.auction?.type?.toUpperCase() === 'PRIVATE' ? 'Request approval' : 'Accept and register'}
                  </button>
                {/if}
              </div>
            {:else}
              {#if lot.fairWarningAt && lot.status.toUpperCase() === 'ACTIVE'}<p role="status" class="mb-4 border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">Fair warning — last chance to bid.</p>{/if}
              {#key lot.id}
                <MaximumBidForm {lot} userId={currentUser.id} canBid={lot.status.toUpperCase() === 'ACTIVE' && lot.auction?.status?.toUpperCase() === 'LIVE' && Boolean(lot.auction?.auctioneerStartedAt) && Boolean(lot.endTime && new Date(lot.endTime).getTime() > Date.now())} onbid={async () => { await loadLot(); await loadBids(); }} />
              {/key}
            {/if}

            <div class="mt-6 pt-6 border-t">
              <p class="text-sm text-gray-600 mb-2">Lot ends:</p>
              <p class="font-semibold">{formatDate(lot.endTime)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
    <div class="text-center">
      <p class="text-gray-600 text-lg">Lot not found</p>
      <button
        onclick={() => goto('/')}
        class="mt-4 px-6 py-2 bg-[#18372f] text-white rounded-lg hover:bg-[#152c26]"
      >
        Back to Auctions
      </button>
    </div>
  </div>
{/if}
