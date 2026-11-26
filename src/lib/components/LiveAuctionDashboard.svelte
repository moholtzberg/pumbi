<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { requiresBidderRegistration } from '$lib/utils/biddingAccess.js';
  import MaximumBidForm from '$lib/components/MaximumBidForm.svelte';
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';
  import AuctionActivity from '$lib/components/AuctionActivity.svelte';
  import AuctionLiveVideo from '$lib/components/AuctionLiveVideo.svelte';
  import { broadcastInfo } from '$lib/utils/broadcastInfo.js';

  import { mediaEmbedUrl } from '$lib/utils/mediaEmbed.js';

  let { auction, videoUrl = null, videoTitle = null, audioUrl = null, audioTitle = null } = $props();
  let liveData = $state({
    currentLot: null,
    pastLots: [],
    upcomingLots: [],
    lotRail: [],
    recentBids: [],
    timing: null,
    lobby: true,
    biddingOpen: false,
    finished: false,
    auctionStatus: null
  });
  let loading = $state(true);
  let refreshTimer;
  let session = $state(null);
  let bidding = $state(false);
  let bidError = $state('');
  let bidSuccess = $state(false);
  let bidSuccessTimer;
  let bidAccess = $state(null);
  let checkingAccess = $state(false);
  let lastAccessCheck = 0;
  let acceptTerms = $state(false);
  let registering = $state(false);
  let registerError = $state('');

  let nextBidAmount = $derived.by(() => {
    const lot = liveData.currentLot;
    if (!lot) return 0;
    const currentBid = Number(lot.currentBid) || 0;
    const startingBid = Number(lot.startingBid) || 0;
    const increment = Number(lot.bidIncrement) || 0;
    return Math.max(startingBid, currentBid + increment);
  });

  let readyToBid = $derived(Boolean(bidAccess?.readyToBid));
  let canBidNow = $derived(
    Boolean(liveData.currentLot && liveData.biddingOpen && nextBidAmount > 0 && readyToBid)
  );
  let upcomingLots = $derived(liveData.upcomingLots || []);
  let pastLots = $derived(liveData.pastLots || []);
  let lotRail = $derived(
    (liveData.lotRail && liveData.lotRail.length
      ? liveData.lotRail.filter((lot) => lot.phase !== 'current')
      : [...pastLots, ...upcomingLots]) || []
  );
  let lotBids = $derived(liveData.recentBids || []);
  let isPublicAuction = $derived(
    String(bidAccess?.auctionType || auction?.type || '').toUpperCase() === 'PUBLIC'
  );
  let buyerTerms = $derived(
    bidAccess?.buyerTerms ||
      auction?.buyerTermsSnapshot ||
      auction?.privateHouseBuyerTermsSnapshot ||
      ''
  );
  let premiumLabel = $derived.by(() => {
    const rate = bidAccess?.buyerPremiumRate ?? auction?.buyerPremiumRateSnapshot ?? auction?.privateHouseBuyerPremiumRateSnapshot;
    if (rate == null || rate === '') return null;
    return `${Number(rate) * 100}%`;
  });
  let streamSrc = $derived(mediaEmbedUrl(videoUrl));
  let broadcastLive = $state(false);
  let overlay = $derived(broadcastInfo({ auction, currentLot: liveData.currentLot, nextLot: upcomingLots[0], biddingOpen: liveData.biddingOpen }));


  async function loadSession() {
    try {
      const res = await fetch('/auth/session', { credentials: 'include' });
      if (res.ok) session = await res.json();
    } catch {
      session = null;
    }
  }

  async function loadBidAccess() {
    if (!session?.user) {
      bidAccess = null;
      return;
    }
    checkingAccess = true;
    registerError = '';
    try {
      const response = await fetch(`/api/auctions/${auction.id}/register`, {
        credentials: 'include'
      });
      if (response.status === 401) {
        bidAccess = null;
        return;
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to check bidding access');
      }
      bidAccess = await response.json();
      lastAccessCheck = Date.now();
      if (bidAccess.readyToBid) acceptTerms = true;
    } catch (err) {
      registerError = err.message || 'Failed to check bidding access';
    } finally {
      checkingAccess = false;
    }
  }

  async function acceptAuctionTerms() {
    if (!session?.user) {
      goto(`/auth/login?redirect=${encodeURIComponent($page.url.pathname)}`);
      return;
    }
    if (!acceptTerms) {
      registerError = 'Check the box to accept this auction’s buyer terms before continuing.';
      return;
    }
    registering = true;
    registerError = '';
    bidError = '';
    try {
      const response = await fetch(`/api/auctions/${auction.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acceptedTerms: true })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to accept auction terms');
      }
      await loadBidAccess();
    } catch (err) {
      registerError = err.message || 'Failed to accept auction terms';
    } finally {
      registering = false;
    }
  }

  async function refresh() {
    try {
      const response = await fetch(`/api/auctions/${auction.id}/live`);
      if (response.ok) {
        liveData = await response.json();
        if (session?.user && bidAccess && liveData.currentLot && (Date.now() - lastAccessCheck >= 10000 || bidAccess.registrationRequired !== requiresBidderRegistration(liveData.currentLot.auction || auction))) await loadBidAccess();
      }
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

    if (bidAccess?.blocked) { bidError = 'This auction house has blocked your bidding access. Contact the house for assistance.'; return; }
    if (bidAccess?.needsVerification) {
      bidError = 'Complete buyer verification before bidding.';
      return;
    }

    if (!readyToBid) {
      bidError = isPublicAuction
        ? 'Accept this auction’s buyer terms before bidding.'
        : 'Your bidder registration must be approved before bidding.';
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
        if (response.status === 403) {
          await loadBidAccess();
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
    if (bidAccess?.blocked) return 'Bidding blocked by house';
    if (bidAccess?.needsVerification) return 'Verify to bid';
    if (!readyToBid) return isPublicAuction ? 'Accept terms to bid' : 'Registration required';
    if (!liveData.biddingOpen) {
      return liveData.lobby ? 'Waiting for auctioneer' : 'Bidding closed';
    }
    return `Bid ${money(nextBidAmount)}`;
  }

  function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (auction?.currency || 'usd').toUpperCase() }).format(amount || 0);
  }

  function time(value) {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  onMount(async () => {
    await loadSession();
    await Promise.all([refresh(), loadBidAccess()]);
    refreshTimer = setInterval(refresh, 2000);
  });
  onDestroy(() => {
    clearInterval(refreshTimer);
    clearTimeout(bidSuccessTimer);
  });
</script>

<section class="live-room pb-24 md:pb-0">
  <div class="container mx-auto px-4 py-6 lg:py-8">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><div class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#d6b477]"><span class="h-2 w-2 animate-pulse bg-[#a95739]"></span> Live auction</div><h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold lg:text-4xl">{auction.title}</h1></div>
      <a href="#all-lots" class="border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide hover:bg-white/10">Browse all lots</a>
    </div>
    {#if loading}
      <div class="p-12 text-center"><PumbiLoader size="lg" label="Loading the live room" /><p class="mt-4">Loading the live room…</p></div>
    {:else if liveData.finished || ['ENDED', 'CANCELLED'].includes(String(liveData.auctionStatus || auction?.status || '').toUpperCase())}
      <div class="border border-white/15 p-12 text-center"><h2 class="text-2xl font-semibold">This auction has ended</h2><p class="mt-2 text-[#91a29a]">Browse the catalog below for results and lot details.</p><a href="#all-lots" class="mt-5 inline-flex border border-white/20 px-4 py-2 text-sm">View lots</a></div>
    {:else}
      <div class="grid items-start gap-5 lg:grid-cols-2" aria-label="Live auction split screen">
        <section class="min-w-0" aria-label="Current lot on the block">
          {#if liveData.currentLot}
          <article class="overflow-hidden rounded-sm bg-white text-slate-950 shadow-2xl">
            <div class="aspect-[16/10] max-h-[360px] overflow-hidden bg-slate-100">
              {#if liveData.currentLot.imageUrl}<img src={liveData.currentLot.imageUrl} alt={liveData.currentLot.title} class="h-full w-full object-contain" />{:else}<div class="grid h-full place-items-center text-[#91a29a]">No image</div>{/if}
            </div>
            <div class="flex flex-col p-5 lg:p-7">
              <p class="text-xs font-semibold uppercase tracking-widest text-[#18372f]">
                {liveData.biddingOpen ? 'On the block' : liveData.lobby ? 'Up next' : 'Coming up'} · Lot #{liveData.currentLot.lotNumber}
              </p>
              <h2 class="mt-2 text-2xl font-semibold lg:text-3xl">{liveData.currentLot.title}</h2>
              <p class="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{liveData.currentLot.description || ''}</p>
              <div class="mt-auto grid grid-cols-2 gap-4 pt-6">
                <div><p class="text-xs font-bold uppercase tracking-wide text-[#84958d]">Current price</p><p class="mt-1 text-3xl font-semibold text-[#18372f]">{money(liveData.currentLot.currentBid || liveData.currentLot.startingBid)}</p></div>
                <div class="text-right">
                  <p class="text-xs font-bold uppercase tracking-wide text-[#84958d]">Time remaining</p>
                  <p class="mt-1 text-3xl font-semibold text-[#a95739]">
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
                <p class="mt-4 rounded-lg bg-[#e8eee9] px-3 py-2 text-sm font-semibold text-[#18372f]">Bid placed successfully</p>
              {/if}

              {#if session?.user && (checkingAccess || bidAccess)}
                {#if checkingAccess && !bidAccess}
                  <div class="mt-5 rounded-sm border border-slate-200 bg-[#f7f4ee] px-4 py-3 text-sm text-slate-600">
                    Checking whether you’re ready to bid…
                  </div>
                {:else if bidAccess?.blocked}
                  <div role="status" class="mt-5 border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p class="font-bold">Bidding access blocked by this house</p><p class="mt-1">Contact the auction house for assistance. Completing verification or registration will not remove this block.</p></div>
                {:else if bidAccess?.needsVerification}
                  <div class="mt-5 rounded-sm border border-amber-200 bg-amber-50 p-4">
                    <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">Not ready to bid</p>
                    <p class="mt-1 font-bold text-amber-950">Finish buyer verification first</p>
                    <p class="mt-1 text-sm text-amber-800">Same checklist as account onboarding: email, phone, ID, and card must be complete before you can bid here.</p>
                    <a href="/dashboard/verification" class="mt-3 inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800">Continue verification</a>
                  </div>
                {:else if bidAccess?.registrationRequired && bidAccess?.status === 'PENDING'}
                  <div class="mt-5 rounded-sm border border-[#ddd6ca] bg-[#efe8dc] p-4">
                    <p class="text-xs font-semibold uppercase tracking-wide text-[#18372f]">Not ready to bid</p>
                    <p class="mt-1 font-bold text-blue-950">Waiting for auction-house approval</p>
                    <p class="mt-1 text-sm text-[#18372f]">Your registration was submitted. You’ll be able to bid once the house approves you.</p>
                  </div>
                {:else if bidAccess?.registrationRequired && bidAccess?.status === 'REJECTED'}
                  <div class="mt-5 rounded-sm border border-red-200 bg-red-50 p-4">
                    <p class="text-xs font-semibold uppercase tracking-wide text-red-700">Not approved</p>
                    <p class="mt-1 font-bold text-red-950">Your bidder registration was not approved</p>
                    <p class="mt-1 text-sm text-red-800">Contact the auction organizer if you need more information.</p>
                  </div>
                {:else if bidAccess?.needsTermsAcceptance}
                  <div class="mt-5 rounded-sm border border-[#ddd6ca] bg-[#efe8dc] p-4">
                    <p class="text-xs font-semibold uppercase tracking-wide text-[#18372f]">Not ready to bid</p>
                    <p class="mt-1 font-bold text-[#152c26]">
                      {isPublicAuction ? 'Accept this auction’s buyer terms' : 'Accept house terms to request approval'}
                    </p>
                    <p class="mt-1 text-sm text-[#18372f]">
                      {isPublicAuction
                        ? 'Public auctions require accepting Pumbi’s buyer terms and rates for this sale before you can place a bid.'
                        : 'Submit your acceptance so the auction house can review your bidder registration.'}
                    </p>
                    {#if premiumLabel}
                      <p class="mt-2 text-sm font-semibold text-[#152c26]">Buyer premium: {premiumLabel}</p>
                    {/if}
                    {#if buyerTerms}
                      <details class="mt-3 rounded-lg border border-[#ddd6ca] bg-white p-3">
                        <summary class="cursor-pointer text-sm font-bold text-[#152c26]">Read buyer terms</summary>
                        <p class="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">{buyerTerms}</p>
                      </details>
                    {/if}
                    <label class="mt-3 flex items-start gap-2 text-sm font-semibold text-[#152c26]">
                      <input type="checkbox" class="mt-1 rounded border-[#c4b8a8] text-[#18372f] focus:ring-[#18372f]" bind:checked={acceptTerms} />
                      <span>
                        I have read and accept the buyer terms{premiumLabel ? ` and ${premiumLabel} buyer premium` : ''} for this auction{bidAccess?.policyVersion != null ? ` (policy v${bidAccess.policyVersion})` : ''}.
                      </span>
                    </label>
                    {#if registerError}
                      <p class="mt-2 text-sm font-semibold text-red-700">{registerError}</p>
                    {/if}
                    <button
                      type="button"
                      onclick={acceptAuctionTerms}
                      disabled={registering || !acceptTerms}
                      class="mt-3 inline-flex rounded-lg bg-[#18372f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#152c26] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {registering
                        ? 'Saving…'
                        : isPublicAuction
                          ? 'Accept terms and enable bidding'
                          : 'Accept terms and request approval'}
                    </button>
                  </div>
                {:else if readyToBid}
                  <div class="mt-4 rounded-lg border border-[#c5d0c8] bg-[#e8eee9] px-3 py-2 text-sm font-semibold text-[#18372f]">
                    {bidAccess?.registrationRequired ? 'You’re cleared to bid on this auction.' : 'You’re signed in and ready to bid. No registration or approval is required.'}
                  </div>
                {/if}
              {/if}

              {#if liveData.currentLot.fairWarningAt && liveData.biddingOpen}<p role="status" class="mt-4 border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">Fair warning — last chance to bid.</p>{/if}
              {#if session?.user && readyToBid}
                {#key liveData.currentLot.id}
                  <MaximumBidForm currency={auction?.currency || 'usd'} lot={liveData.currentLot} userId={session.user.id} canBid={liveData.biddingOpen} onbid={refresh} />
                {/key}
              {:else}
                <button type="button" onclick={placeBid} disabled={bidding || !nextBidAmount || (Boolean(session?.user) && !canBidNow)} class="mt-5 w-full bg-[#18372f] px-5 py-3.5 font-semibold text-white disabled:opacity-60">{bidButtonLabel()}</button>
              {/if}
              <a href={`/lots/${liveData.currentLot.id}`} class="mt-3 block rounded-sm border border-slate-300 bg-white p-3 text-center text-sm font-semibold text-slate-800">View lot details</a>
            </div>
          </article>
          {:else}
            <div class="grid min-h-80 place-items-center border border-white/15 bg-white/5 p-8 text-center"><div><h2 class="text-2xl font-semibold">Waiting for the next lot</h2><p class="mt-2 text-sm text-[#91a29a]">The auctioneer will put the next lot on the block shortly.</p></div></div>
          {/if}
        </section>
        <aside class="min-w-0 space-y-4 lg:sticky lg:top-24" aria-label="Live video broadcast">
          <AuctionLiveVideo auctionId={auction.id} {overlay} alwaysShow fallbackSrc={streamSrc} fallbackTitle={videoTitle} onlivechange={live => { broadcastLive = live; }} />
          {#if audioUrl && !broadcastLive}
            <div class="border border-white/15 p-4"><p class="text-sm font-semibold">{audioTitle || 'Live auction audio'}</p><audio controls preload="none" src={audioUrl} class="mt-2 h-9 w-full"></audio></div>
          {/if}
          <p class="text-xs text-[#91a29a]">Video starts automatically when the auctioneer broadcasts. Enable sound to listen. The lot and next-lot graphics update with the auction.</p>
        </aside>
      </div>
      <AuctionActivity auctionId={auction.id} lotId={liveData.currentLot?.id} />
      <div class="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <aside class="overflow-hidden rounded-sm border border-[rgba(215,190,150,0.18)] bg-[rgba(255,255,255,0.04)]">
          <div class="border-b border-[rgba(215,190,150,0.18)] px-5 py-4">
            <h2 class="font-semibold">Lots</h2>
            <p class="text-xs text-[#91a29a]">Scroll for past and upcoming</p>
          </div>
          {#if lotRail.length === 0}
            <p class="p-6 text-sm text-[#91a29a]">No other lots in this sale yet.</p>
          {:else}
            <div class="max-h-[440px] overflow-y-auto">
              {#if pastLots.length}
                <div class="sticky top-0 z-10 border-b border-[rgba(215,190,150,0.18)] bg-[rgba(21,44,38,0.92)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#91a29a] backdrop-blur">
                  Past · {pastLots.length}
                </div>
                <div class="divide-y divide-white/10">
                  {#each pastLots as lot}
                    <a href={`/lots/${lot.id}`} class="flex gap-3 p-4 opacity-75 transition hover:bg-[rgba(255,255,255,0.04)] hover:opacity-100">
                      <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#1f3a32]">
                        {#if lot.imageUrl}
                          <img src={lot.imageUrl} alt="" class="h-full w-full object-cover" />
                        {:else}
                          <div class="grid h-full place-items-center text-[10px] text-[#84958d]">No img</div>
                        {/if}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between gap-2">
                          <p class="text-xs font-bold uppercase tracking-wide text-[#84958d]">Lot #{lot.lotNumber}</p>
                          <span class="rounded bg-[#1f3a32] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#bec9c4]">{lot.status === 'SOLD' ? 'Sold' : lot.status === 'UNSOLD' ? 'Unsold' : 'Closed'}</span>
                        </div>
                        <p class="truncate font-bold text-[#d7ded9]">{lot.title}</p>
                        <p class="mt-1 text-sm font-semibold text-[#91a29a]">{money(lot.currentBid || lot.startingBid)}</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {/if}

              {#if upcomingLots.length}
                <div class="sticky top-0 z-10 border-b border-[rgba(215,190,150,0.18)] bg-[rgba(21,44,38,0.92)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d6b477] backdrop-blur">
                  Upcoming · {upcomingLots.length}
                </div>
                <div class="divide-y divide-white/10">
                  {#each upcomingLots as lot, index}
                    <a href={`/lots/${lot.id}`} class="flex gap-3 p-4 transition hover:bg-[rgba(255,255,255,0.04)]">
                      <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#1f3a32]">
                        {#if lot.imageUrl}
                          <img src={lot.imageUrl} alt="" class="h-full w-full object-cover" />
                        {:else}
                          <div class="grid h-full place-items-center text-[10px] text-[#84958d]">No img</div>
                        {/if}
                        <span class="absolute left-1 top-1 rounded bg-[#18372f]/90 px-1.5 py-0.5 text-[10px] font-bold">{index + 1}</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-xs font-bold uppercase tracking-wide text-[#91a29a]">Lot #{lot.lotNumber}</p>
                        <p class="truncate font-bold text-white">{lot.title}</p>
                        <p class="mt-1 text-sm font-semibold text-[#d6b477]">{money(lot.currentBid || lot.startingBid)}</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </aside>
        {#if liveData.currentLot}
        <aside class="overflow-hidden rounded-sm border border-[rgba(215,190,150,0.18)] bg-[rgba(255,255,255,0.04)]">
          <div class="border-b border-[rgba(215,190,150,0.18)] px-5 py-4">
            <h2 class="font-semibold">Bid history</h2>
            <p class="text-xs text-[#91a29a]">
              Lot #{liveData.currentLot.lotNumber} · updates automatically
            </p>
          </div>
          {#if lotBids.length === 0}
            <p class="p-6 text-sm text-[#91a29a]">No bids on this lot yet.</p>
          {:else}
            <div class="max-h-[440px] divide-y divide-white/10 overflow-y-auto">
              {#each lotBids as bid, index}
                <div class={`p-4 ${index === 0 ? 'bg-[#efe8dc]0/10' : ''}`}>
                  <div class="flex items-center justify-between gap-4">
                    <div class="min-w-0">
                      <p class="truncate font-bold">{bid.bidderName}{#if bid.isAutomatic}<span class="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800">Auto</span>{/if}{#if bid.source === 'PHONE'}<span class="ml-2 rounded border border-[#d6b477]/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#d6b477]">Phone</span>{/if}</p>
                      <p class="text-xs text-[#91a29a]">{index === 0 ? 'High bid' : `Bid #${lotBids.length - index}`}</p>
                    </div>
                    <div class="text-right">
                      <p class="font-semibold text-[#d6b477]">{money(bid.amount)}</p>
                      <p class="text-xs text-[#84958d]">{time(bid.timestamp)}</p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </aside>
        {/if}
      </div>
      {#if liveData.currentLot}
      <!-- Sticky actions so Bid / Details stay reachable while watching video -->
      <div class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.18)] backdrop-blur md:hidden">
        {#if session?.user && bidAccess?.needsTermsAcceptance}
          <p class="mb-2 text-center text-xs font-semibold text-[#18372f]">Accept auction terms above before bidding</p>
        {:else if session?.user && bidAccess?.needsVerification}
          <p class="mb-2 text-center text-xs font-semibold text-amber-800">Complete buyer verification before bidding</p>
        {/if}
        <div class="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button
            type="button"
            onclick={placeBid}
            disabled={bidding || !nextBidAmount || (Boolean(session?.user) && !canBidNow)}
            class="rounded-sm bg-[#18372f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {bidButtonLabel()}
          </button>
          <a
            href={`/lots/${liveData.currentLot.id}`}
            class="rounded-sm border-2 border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-800"
          >
            Lot details
          </a>
        </div>
      </div>

      {/if}
    {/if}
  </div>
</section>

<style>
  .live-room {
    background: #152c26;
    color: #f7f4ee;
  }
  .live-room h1,
  .live-room h2 {
    font-family: var(--pumbi-serif);
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .live-room :global(.pumbi-lot-card) {
    background: #fff;
    color: #1a2821;
  }
</style>
