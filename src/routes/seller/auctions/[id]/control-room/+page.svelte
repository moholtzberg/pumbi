<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';

  let data = $state(null);
  let loading = $state(true);
  let errorMessage = $state('');
  let actionError = $state('');
  let actionSuccess = $state('');
  let busyAction = $state('');
  let autoClosingExpired = $state(false);
  let refreshTimer;
  let successTimer;

  let auctionId = $derived($page.params.id);
  let isAuctioneer = $derived(Boolean(data?.auction?.auctioneerId && data.auction.auctioneerId === data.currentUserId));
  let openLot = $derived(data?.lots?.find((lot) => lot.id === data.openLotId) || null);
  let nextLot = $derived(data?.lots?.find((lot) => lot.id === data.nextLotId) || null);
  let auctionEnded = $derived(['ENDED', 'CANCELLED'].includes(data?.auction?.status));
  let canEndAuction = $derived(Boolean(isAuctioneer && data?.canEndAuction && !auctionEnded));
  let allLotsComplete = $derived(Boolean(data?.allLotsComplete));
  let autoAdvanceNextLot = $derived(Boolean(data?.autoAdvanceNextLot));
  let defaultExtendSeconds = $derived(Number(data?.defaultExtendSeconds) || 30);
  let extendPresets = $derived(
    [...new Set([15, 30, 60, defaultExtendSeconds].filter((n) => n > 0))].sort((a, b) => a - b)
  );

  async function refresh() {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/control-room`, { credentials: 'include' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load control room');
      }
      data = await response.json();
      errorMessage = '';

      // If auto-advance is on and the on-block lot timer has expired, hammer it so the next lot can open.
      const blockId = data.onBlockLotId || data.openLotId;
      const expiredOpen =
        data.autoAdvanceNextLot &&
        blockId &&
        data.auction?.auctioneerId === data.currentUserId &&
        data.lots?.find((lot) => {
          if (lot.id !== blockId || lot.status !== 'ACTIVE' || !lot.endTime) return false;
          return new Date(lot.endTime).getTime() <= Date.now();
        });
      if (expiredOpen && !autoClosingExpired && !busyAction) {
        autoClosingExpired = true;
        try {
          await runAction('close', expiredOpen.id);
        } finally {
          autoClosingExpired = false;
        }
      }
    } catch (err) {
      errorMessage = err.message || 'Failed to load control room';
    } finally {
      loading = false;
    }
  }

  async function runAction(action, lotId = null, extra = {}) {
    actionError = '';
    actionSuccess = '';
    busyAction = action === 'extend'
      ? `extend:${lotId || 'none'}:${extra.seconds || ''}`
      : `${action}:${lotId || 'none'}`;
    try {
      if (action === 'end') {
        const remaining = data?.remainingReadyLots || 0;
        const message =
          remaining > 0
            ? `End this auction and mark ${remaining} remaining ready lot${remaining === 1 ? '' : 's'} as unsold?`
            : 'End this auction and mark it as finished?';
        if (!confirm(message)) {
          busyAction = '';
          return;
        }
      }

      const response = await fetch(`/api/auctions/${auctionId}/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...(lotId ? { lotId } : {}), ...extra })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Failed to ${action}`);
      }
      const result = await response.json().catch(() => ({}));
      actionSuccess =
        action === 'claim'
          ? 'You claimed the auctioneer seat'
          : action === 'start'
            ? 'Auction started — first lot is open'
            : action === 'open'
              ? 'Lot opened for bidding'
              : action === 'extend'
                ? `Added ${result.seconds || extra.seconds || defaultExtendSeconds}s to the lot`
                : action === 'end'
                  ? 'Auction ended'
                  : result.auctionEnded
                    ? 'Lot closed — auction finished'
                    : result.autoAdvanced
                      ? `Lot closed — next lot #${result.nextLot?.lotNumber || ''} is on the block`
                      : 'Lot closed';
      clearTimeout(successTimer);
      successTimer = setTimeout(() => {
        actionSuccess = '';
      }, 3000);
      await refresh();
    } catch (err) {
      actionError = err.message || `Failed to ${action}`;
    } finally {
      busyAction = '';
    }
  }

  async function setAutoAdvance(enabled) {
    if (!isAuctioneer) return;
    actionError = '';
    busyAction = 'settings:autoAdvance';
    try {
      const response = await fetch(`/api/auctions/${auctionId}/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'settings', autoAdvanceNextLot: enabled })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update auto-advance setting');
      }
      actionSuccess = enabled
        ? 'Auto-advance on — next lot opens after each hammer'
        : 'Auto-advance off — you will open each lot manually';
      clearTimeout(successTimer);
      successTimer = setTimeout(() => {
        actionSuccess = '';
      }, 3000);
      await refresh();
    } catch (err) {
      actionError = err.message || 'Failed to update auto-advance setting';
    } finally {
      busyAction = '';
    }
  }

  function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  }

  function time(value) {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  function lotState(lot) {
    if (!lot) return '—';
    if (lot.id === data?.openLotId) return 'ON BLOCK';
    if (lot.status === 'SOLD') return 'SOLD';
    if (lot.status === 'UNSOLD') return 'UNSOLD';
    if (lot.status === 'WITHDRAWN') return 'WITHDRAWN';
    if (!lot.isReady) return 'NOT READY';
    return 'QUEUED';
  }

  onMount(() => {
    refresh();
    refreshTimer = setInterval(refresh, 2000);
  });
  onDestroy(() => {
    clearInterval(refreshTimer);
    clearTimeout(successTimer);
  });
</script>

<div class="min-h-screen bg-slate-100">
  <div class="border-b border-slate-200 bg-slate-950 text-white">
    <div class="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-5">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Auctioneer control room</p>
        <h1 class="mt-1 text-2xl font-black">{data?.auction?.title || 'Loading…'}</h1>
        {#if data?.auction}
          <p class="mt-1 text-sm text-slate-300">
            Status: <span class="font-semibold text-white">{data.auction.status}</span>
            · Finished lots: {data.finishedLots || 0}
            · Remaining ready: {data.remainingReadyLots || 0}
            · Approved bidders: {data.registrations?.APPROVED || 0}
          </p>
        {/if}
      </div>
      <div class="flex flex-wrap gap-2">
        {#if canEndAuction}
          <button
            type="button"
            class="rounded-lg bg-[#a95739] px-4 py-2 text-sm font-bold text-white hover:bg-[#8f482f] disabled:opacity-60"
            disabled={Boolean(busyAction)}
            onclick={() => runAction('end')}
          >
            {busyAction.startsWith('end') ? 'Ending…' : allLotsComplete ? 'End auction' : 'End auction early'}
          </button>
        {/if}
        <a href={`/auctions/${auctionId}`} class="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10" target="_blank" rel="noreferrer">Public live room</a>
        <a href={`/seller/auctions/${auctionId}/lots`} class="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">Manage lots</a>
        <a href={`/seller/auctions/${auctionId}/settings`} class="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">Settings</a>
        <a href="/seller" class="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900">Seller home</a>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-6">
    {#if loading}
      <div class="rounded-2xl bg-white p-12 text-center text-slate-500">
        <PumbiLoader size="lg" label="Loading control room" />
        <p class="mt-4">Loading control room…</p>
      </div>
    {:else if errorMessage}
      <div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">{errorMessage}</div>
    {:else if data}
      {#if actionError}
        <div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</div>
      {/if}
      {#if actionSuccess}
        <div class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{actionSuccess}</div>
      {/if}

      <div class="mb-5 grid gap-4 lg:grid-cols-3">
        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Auctioneer seat</p>
          {#if !data.auction.auctioneerId}
            <p class="mt-2 text-lg font-black text-slate-900">Unclaimed</p>
            <button
              type="button"
              class="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={Boolean(busyAction)}
              onclick={() => runAction('claim')}
            >
              {busyAction.startsWith('claim') ? 'Claiming…' : 'Claim auctioneer seat'}
            </button>
          {:else if isAuctioneer}
            <p class="mt-2 text-lg font-black text-emerald-700">You are the auctioneer</p>
            <p class="mt-1 text-sm text-slate-500">Only you can start lots and move the sale along.</p>
          {:else}
            <p class="mt-2 text-lg font-black text-amber-700">Seat taken</p>
            <p class="mt-1 text-sm text-slate-600">{data.auction.auctioneer?.name || data.auction.auctioneer?.email || 'Another team member'} is controlling this auction.</p>
          {/if}
        </div>

        <div class="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Auto-advance lots</p>
              <p class="mt-2 text-lg font-black text-slate-900">
                {autoAdvanceNextLot ? 'On — next lot opens after hammer' : 'Off — open each lot manually'}
              </p>
              <p class="mt-1 text-sm text-slate-500">
                Default lives under auction Settings → Live Auction. Change it here while the sale is running.
              </p>
            </div>
            {#if isAuctioneer && !auctionEnded}
              <button
                type="button"
                class="rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60 {autoAdvanceNextLot ? 'bg-slate-700 hover:bg-slate-800' : 'bg-violet-700 hover:bg-violet-800'}"
                disabled={Boolean(busyAction)}
                onclick={() => setAutoAdvance(!autoAdvanceNextLot)}
              >
                {busyAction === 'settings:autoAdvance'
                  ? 'Saving…'
                  : autoAdvanceNextLot
                    ? 'Turn auto-advance off'
                    : 'Turn auto-advance on'}
              </button>
            {:else if !isAuctioneer}
              <a href={data.settingsPath || `/seller/auctions/${auctionId}/settings`} class="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Change in Settings
              </a>
            {/if}
          </div>
        </div>
      </div>

      <div class="mb-5 grid gap-4 lg:grid-cols-2">
        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500">On the block</p>
          {#if openLot}
            <p class="mt-2 text-lg font-black text-slate-900">Lot #{openLot.lotNumber} · {openLot.title}</p>
            <p class="mt-1 text-2xl font-black text-violet-700">{money(openLot.currentBid || openLot.startingBid)}</p>
            <p class="mt-1 text-sm text-slate-500">
              High bidder: {openLot.highestBidderName || 'None yet'}
            </p>
            {#if openLot.endTime}
              <p class="mt-2 text-sm font-semibold text-red-600">
                Time left: <CountdownTimer targetDate={openLot.endTime} label="" />
              </p>
              {#if autoAdvanceNextLot && new Date(openLot.endTime).getTime() <= Date.now()}
                <p class="mt-2 text-xs font-semibold text-amber-700">Timer expired — auto-advancing to the next lot…</p>
              {/if}
            {/if}
            {#if isAuctioneer && !auctionEnded}
              <div class="mt-4">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Add time</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  {#each extendPresets as seconds}
                    <button
                      type="button"
                      class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                      disabled={Boolean(busyAction)}
                      onclick={() => runAction('extend', openLot.id, { seconds })}
                    >
                      {busyAction.startsWith(`extend:${openLot.id}:${seconds}`) ? 'Adding…' : `+${seconds}s`}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
            <button
              type="button"
              class="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-60"
              disabled={!isAuctioneer || Boolean(busyAction)}
              onclick={() => runAction('close', openLot.id)}
            >
              {busyAction.startsWith(`close:${openLot.id}`) ? 'Closing…' : openLot.highestBidderId ? 'Hammer down · Mark sold' : 'Close · Mark unsold'}
            </button>
          {:else}
            <p class="mt-2 text-lg font-black text-slate-900">No lot open</p>
            <p class="mt-1 text-sm text-slate-500">Open the next queued lot when you are ready.</p>
          {/if}
        </div>

        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Next up</p>
          {#if nextLot}
            <p class="mt-2 text-lg font-black text-slate-900">Lot #{nextLot.lotNumber} · {nextLot.title}</p>
            <p class="mt-1 text-sm text-slate-500">Start at {money(nextLot.startingBid)}</p>
            {#if !data.auction.auctioneerStartedAt}
              <button
                type="button"
                class="mt-4 w-full rounded-xl bg-violet-700 px-4 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                disabled={!isAuctioneer || Boolean(busyAction) || Boolean(openLot)}
                onclick={() => runAction('start', nextLot.id)}
              >
                {busyAction === `start:${nextLot.id}` ? 'Starting…' : 'Start auction on this lot'}
              </button>
            {:else}
              <button
                type="button"
                class="mt-4 w-full rounded-xl bg-violet-700 px-4 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                disabled={!isAuctioneer || Boolean(busyAction) || Boolean(openLot)}
                onclick={() => runAction('open', nextLot.id)}
              >
                {busyAction === `open:${nextLot.id}` ? 'Opening…' : 'Open this lot for bidding'}
              </button>
            {/if}
            {#if openLot}
              <p class="mt-2 text-xs font-semibold text-amber-700">Close the current lot before opening the next one.</p>
            {/if}
          {:else}
            <p class="mt-2 text-lg font-black text-slate-900">No queued lots</p>
            {#if auctionEnded}
              <p class="mt-1 text-sm text-slate-500">This auction is finished.</p>
            {:else if allLotsComplete}
              <p class="mt-1 text-sm text-slate-500">All ready lots are complete. End the auction to mark it finished.</p>
              <button
                type="button"
                class="mt-4 w-full rounded-xl bg-[#18372f] px-4 py-3 font-bold text-white hover:bg-[#152c26] disabled:opacity-60"
                disabled={!canEndAuction || Boolean(busyAction)}
                onclick={() => runAction('end')}
              >
                {busyAction.startsWith('end') ? 'Ending…' : 'End auction'}
              </button>
            {:else}
              <p class="mt-1 text-sm text-slate-500">Mark lots ready in Manage Lots to queue them here.</p>
            {/if}
          {/if}
        </div>
      </div>

      {#if auctionEnded}
        <div class="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700">
          Auction status is <span class="uppercase">{data.auction.status}</span>. The public room will no longer accept bids.
        </div>
      {:else if allLotsComplete && canEndAuction}
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ddd6ca] bg-[#efe8dc] px-5 py-4">
          <div>
            <p class="font-bold text-[#1a2821]">All lots are done</p>
            <p class="mt-1 text-sm text-[#435048]">Close the sale to set this auction to ended/finished.</p>
          </div>
          <button
            type="button"
            class="rounded-xl bg-[#18372f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#152c26] disabled:opacity-60"
            disabled={Boolean(busyAction)}
            onclick={() => runAction('end')}
          >
            {busyAction.startsWith('end') ? 'Ending…' : 'End auction'}
          </button>
        </div>
      {/if}

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <section class="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div class="border-b border-slate-200 px-5 py-4">
            <h2 class="font-black text-slate-900">Lot order</h2>
            <p class="text-xs text-slate-500">Open, close, and advance lots in catalog order</p>
          </div>
          <div class="max-h-[70vh] overflow-y-auto">
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-3">Lot</th>
                  <th class="px-4 py-3">Title</th>
                  <th class="px-4 py-3">Price</th>
                  <th class="px-4 py-3">State</th>
                  <th class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {#each data.lots as lot}
                  <tr class={lot.id === data.openLotId ? 'bg-violet-50' : ''}>
                    <td class="px-4 py-3 font-bold text-slate-900">#{lot.lotNumber}</td>
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-900">{lot.title}</p>
                      {#if lot.highestBidderName}
                        <p class="text-xs text-slate-500">High: {lot.highestBidderName}</p>
                      {/if}
                    </td>
                    <td class="px-4 py-3 font-semibold text-slate-800">{money(lot.currentBid || lot.startingBid)}</td>
                    <td class="px-4 py-3">
                      <span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{lotState(lot)}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex flex-wrap justify-end gap-2">
                        {#if lot.id === data.openLotId}
                          <button
                            type="button"
                            class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            disabled={!isAuctioneer || Boolean(busyAction)}
                            onclick={() => runAction('close', lot.id)}
                          >
                            Close
                          </button>
                        {:else if lot.status === 'ACTIVE' && lot.isReady}
                          {#if !data.auction.auctioneerStartedAt}
                            <button
                              type="button"
                              class="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                              disabled={!isAuctioneer || Boolean(busyAction) || Boolean(openLot)}
                              onclick={() => runAction('start', lot.id)}
                            >
                              Start here
                            </button>
                          {:else}
                            <button
                              type="button"
                              class="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                              disabled={!isAuctioneer || Boolean(busyAction) || Boolean(openLot)}
                              onclick={() => runAction('open', lot.id)}
                            >
                              Open
                            </button>
                          {/if}
                        {/if}
                        <a href={`/lots/${lot.id}`} class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" target="_blank" rel="noreferrer">View</a>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        <aside class="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div class="border-b border-slate-200 px-5 py-4">
            <h2 class="font-black text-slate-900">Recent bids</h2>
            <p class="text-xs text-slate-500">Live feed across the auction</p>
          </div>
          {#if data.bids.length === 0}
            <p class="p-6 text-sm text-slate-500">No bids yet.</p>
          {:else}
            <div class="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {#each data.bids as bid}
                <div class="px-5 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate font-bold text-slate-900">{bid.bidderName}</p>
                      <p class="truncate text-xs text-slate-500">Lot #{bid.lotNumber} · {bid.lotTitle}</p>
                    </div>
                    <div class="text-right">
                      <p class="font-black text-emerald-700">{money(bid.amount)}</p>
                      <p class="text-xs text-slate-400">{time(bid.timestamp)}</p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </aside>
      </div>
    {/if}
  </div>
</div>
