<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getImageUrl } from '$lib/utils/imageUrl.js';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';

  let { data } = $props();

  let session = $state(data?.session);
  let currentUser = $state(null);
  let auctionHouse = $state(null);
  let auctionHouseLogoUrl = $state(null);
  let myAuctions = $state([]);
  let loading = $state(true);
  let showCreateModal = $state(false);
  let errorMessage = $state('');
  let creating = $state(false);

  let newAuction = $state({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    imageUrl: '',
    status: 'UPCOMING'
  });

  onMount(async () => {
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

      const userResponse = await fetch(`/api/users?email=${encodeURIComponent(session.user.email)}`);
      if (!userResponse.ok) {
        errorMessage = 'User account not found. Please register an auction house first.';
        return;
      }
      currentUser = await userResponse.json();

      if (!currentUser.auctionHouseId) {
        errorMessage = 'You need to register an auction house first.';
        return;
      }

      const auctionHouseResponse = await fetch(`/api/auction-houses?id=${currentUser.auctionHouseId}`);
      if (auctionHouseResponse.ok) {
        auctionHouse = await auctionHouseResponse.json();
        if (auctionHouse?.logoUrl) {
          auctionHouseLogoUrl = await getImageUrl(auctionHouse.logoUrl);
        }
      }

      await loadAuctions();
    } catch (error) {
      console.error('Error loading user data:', error);
      errorMessage = 'Error loading your account data. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function loadAuctions() {
    try {
      if (!currentUser?.auctionHouseId) {
        myAuctions = [];
        return;
      }

      const response = await fetch(`/api/auctions?auctionHouseId=${currentUser.auctionHouseId}`);
      if (!response.ok) {
        myAuctions = [];
        return;
      }

      const auctions = await response.json();
      if (auctions.error || !Array.isArray(auctions)) {
        myAuctions = [];
        return;
      }

      myAuctions = auctions;

      await Promise.all(
        myAuctions.map(async (auction) => {
          try {
            const lotsResponse = await fetch(`/api/lots?auctionId=${auction.id}`);
            if (lotsResponse.ok) {
              const lots = await lotsResponse.json();
              auction.totalLots = Array.isArray(lots) ? lots.length : 0;
              auction.currentBids = Array.isArray(lots)
                ? lots.reduce((sum, lot) => sum + (lot.bids?.length || 0), 0)
                : 0;
            } else {
              auction.totalLots = 0;
              auction.currentBids = 0;
            }
          } catch {
            auction.totalLots = 0;
            auction.currentBids = 0;
          }
        })
      );
      myAuctions = [...myAuctions];
    } catch (error) {
      console.error('Error loading auctions:', error);
      myAuctions = [];
    }
  }

  async function createAuction() {
    try {
      if (!currentUser?.auctionHouseId) {
        errorMessage = 'You must be linked to an auction house to create auctions.';
        return;
      }

      creating = true;
      const startDate = newAuction.startDate
        ? new Date(newAuction.startDate).toISOString()
        : new Date().toISOString();
      const endDate = newAuction.endDate
        ? new Date(newAuction.endDate).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAuction.title,
          description: newAuction.description || null,
          startDate,
          endDate,
          imageUrl: newAuction.imageUrl || null,
          status: newAuction.status.toUpperCase(),
          type: 'PRIVATE',
          auctionHouseId: currentUser.auctionHouseId,
          sellerId: currentUser.id
        })
      });

      if (response.ok) {
        const created = await response.json().catch(() => ({}));
        showCreateModal = false;
        newAuction = {
          title: '',
          description: '',
          startDate: '',
          endDate: '',
          imageUrl: '',
          status: 'UPCOMING'
        };
        if (created?.id) {
          goto(`/seller/auctions/${created.id}`);
          return;
        }
        await loadAuctions();
      } else {
        const error = await response.json().catch(() => ({}));
        errorMessage = error.message || 'Failed to create auction. Please try again.';
      }
    } catch (error) {
      console.error('Error creating auction:', error);
      errorMessage = 'An error occurred while creating the auction. Please try again.';
    } finally {
      creating = false;
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

  function statusTone(status) {
    const value = String(status || '').toUpperCase();
    if (value === 'LIVE') return 'bg-[#a95739] text-white';
    if (value === 'UPCOMING') return 'bg-[var(--pumbi-forest)] text-white';
    return 'bg-[var(--pumbi-cream-deep)] text-[var(--pumbi-ink-soft)]';
  }

  function formatOnboardingStatus(status) {
    return (status || 'DRAFT')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
</script>

<main class="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
  {#if errorMessage}
    <div class="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {errorMessage}
      {#if errorMessage.includes('register an auction house')}
        <a href="/auction-houses/signup" class="ml-2 font-bold underline">Register now</a>
      {/if}
    </div>
  {/if}

  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="pumbi-eyebrow">Seller workspace</p>
      <h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold text-[var(--pumbi-ink)] lg:text-4xl">
        Auctions
      </h1>
      <p class="mt-2 max-w-xl text-sm leading-6 text-[var(--pumbi-ink-soft)]">
        Open an auction to reach its hub — control room, lots, interest, settings, and bidders live there.
      </p>
    </div>
    {#if currentUser?.auctionHouseId}
      <button type="button" class="pumbi-btn" onclick={() => (showCreateModal = true)}>Create auction</button>
    {/if}
  </div>

  {#if auctionHouse && auctionHouse.onboardingStatus !== 'APPROVED'}
    <section class="pumbi-panel mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <p class="pumbi-eyebrow">Onboarding · {formatOnboardingStatus(auctionHouse.onboardingStatus)}</p>
        <p class="mt-2 text-sm text-[var(--pumbi-ink-soft)]">
          Publishing and payouts stay limited until Pumbi approves your house.
        </p>
      </div>
      <a href="/seller/onboarding" class="pumbi-btn">Continue onboarding</a>
    </section>
  {/if}

  {#if loading}
    <div class="py-20 text-center">
      <PumbiLoader size="lg" label="Loading auctions" />
      <p class="mt-4 text-sm text-[var(--pumbi-muted)]">Loading auctions…</p>
    </div>
  {:else if myAuctions.length === 0}
    <section class="pumbi-panel mt-8 px-6 py-16 text-center">
      {#if auctionHouseLogoUrl}
        <img src={auctionHouseLogoUrl} alt="" class="mx-auto mb-4 h-14 w-14 object-contain" />
      {/if}
      <h2 class="font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">No auctions yet</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-[var(--pumbi-ink-soft)]">
        Create your first private sale. You’ll manage lots, the live floor, and bidders from its hub.
      </p>
      <button type="button" class="pumbi-btn mt-6" onclick={() => (showCreateModal = true)}>Create your first auction</button>
    </section>
  {:else}
    <div class="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {#each myAuctions as auction}
        <article class="pumbi-panel overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
          <a href={`/seller/auctions/${auction.id}`} class="block">
            <div class="relative h-44 overflow-hidden bg-[var(--pumbi-cream-deep)]">
              {#if auction.imageUrl}
                <img src={auction.imageUrl} alt={auction.title} class="h-full w-full object-cover" />
              {/if}
              <span class="absolute right-3 top-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide {statusTone(auction.status)}">
                {auction.status || 'Unknown'}
              </span>
            </div>
            <div class="p-5">
              <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--pumbi-muted)]">
                {(auction.type || 'PRIVATE').toUpperCase()} · {auction.totalLots || 0} lots
              </p>
              <h2 class="mt-2 font-[family-name:var(--pumbi-serif)] text-xl font-semibold text-[var(--pumbi-ink)]">
                {auction.title}
              </h2>
              <p class="mt-2 line-clamp-2 text-sm leading-6 text-[var(--pumbi-ink-soft)]">
                {auction.description || 'Open the hub to manage this sale.'}
              </p>
              <div class="mt-4 space-y-1 border-t border-[var(--pumbi-line-soft)] pt-4 text-xs text-[var(--pumbi-ink-soft)]">
                <p><span class="text-[var(--pumbi-muted)]">Starts</span> · {formatDate(auction.startDate)}</p>
                <p><span class="text-[var(--pumbi-muted)]">Ends</span> · {formatDate(auction.endDate)}</p>
              </div>
              <p class="mt-4 text-xs font-bold uppercase tracking-wide text-[var(--pumbi-forest)]">Open hub →</p>
            </div>
          </a>
        </article>
      {/each}
    </div>
  {/if}
</main>

{#if showCreateModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div class="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-[var(--pumbi-line)] bg-[#f7f4ee] shadow-xl">
      <div class="flex items-center justify-between border-b border-[var(--pumbi-line)] px-5 py-4">
        <div>
          <p class="pumbi-eyebrow">New sale</p>
          <h2 class="mt-1 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">Create auction</h2>
        </div>
        <button type="button" class="text-[var(--pumbi-ink-soft)]" onclick={() => (showCreateModal = false)} aria-label="Close">✕</button>
      </div>

      <form
        class="space-y-4 p-5"
        onsubmit={(e) => {
          e.preventDefault();
          createAuction();
        }}
      >
        <p class="border border-[var(--pumbi-line)] bg-white px-4 py-3 text-sm text-[var(--pumbi-ink-soft)]">
          Private auctions keep lot control, rates, and bidder approval with your house.
        </p>
        <label class="block text-sm">
          <span class="font-semibold">Title *</span>
          <input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={newAuction.title} required />
        </label>
        <label class="block text-sm">
          <span class="font-semibold">Description</span>
          <textarea class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" rows="3" bind:value={newAuction.description}></textarea>
        </label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="font-semibold">Start</span>
            <input type="datetime-local" class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={newAuction.startDate} />
          </label>
          <label class="block text-sm">
            <span class="font-semibold">End</span>
            <input type="datetime-local" class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" bind:value={newAuction.endDate} />
          </label>
        </div>
        <div class="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" class="pumbi-btn-secondary" onclick={() => (showCreateModal = false)}>Cancel</button>
          <button type="submit" class="pumbi-btn" disabled={creating}>{creating ? 'Creating…' : 'Create auction'}</button>
        </div>
      </form>
    </div>
  </div>
{/if}
