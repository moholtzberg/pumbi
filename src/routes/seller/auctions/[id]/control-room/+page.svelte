<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import CountdownTimer from '$lib/components/CountdownTimer.svelte';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';
  import AuctionLiveVideo from '$lib/components/AuctionLiveVideo.svelte';
  import AuctionActivity from '$lib/components/AuctionActivity.svelte';
  import InterestTracker from '$lib/components/InterestTracker.svelte';
  import { broadcastInfo } from '$lib/utils/broadcastInfo.js';
  import PhoneBidForm from '$lib/components/PhoneBidForm.svelte';

  let data = $state(null);
  let loading = $state(true);
  let errorMessage = $state('');
  let actionError = $state('');
  let actionSuccess = $state('');
  let busyAction = $state('');
  let phoneBidBusy = $state(false);
  let autoClosingExpired = $state(false);
  let refreshTimer;
  let successTimer;

  let auctionId = $derived($page.params.id);
  let isAuctioneer = $derived(Boolean(data?.auction?.auctioneerId && data.auction.auctioneerId === data.currentUserId));
  let openLot = $derived(data?.lots?.find((lot) => lot.id === data.openLotId) || null);
  let nextLot = $derived(data?.lots?.find((lot) => lot.id === data.nextLotId) || null);
  let broadcastLot = $derived(openLot || nextLot);
  let broadcastNextLot = $derived(data?.lots?.find(lot => lot.status === 'ACTIVE' && lot.isReady && lot.id !== broadcastLot?.id) || null);
  let overlay = $derived(broadcastInfo({ auction: data?.auction, currentLot: broadcastLot, nextLot: broadcastNextLot, biddingOpen: Boolean(openLot?.endTime && new Date(openLot.endTime).getTime() > Date.now()) }));
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
        throw new Error(err.message || ui("Failed to load control room"));
      }
      data = await response.json();
      errorMessage = '';

      // Auto-advance gives a final warning window before hammering an expired lot.
      const blockId = data.onBlockLotId || data.openLotId;
      const expiredOpen =
        data.autoAdvanceNextLot &&
        blockId &&
        data.auction?.auctioneerId === data.currentUserId &&
        data.lots?.find((lot) => {
          if (lot.id !== blockId || lot.status !== 'ACTIVE' || !lot.endTime) return false;
          return new Date(lot.endTime).getTime() <= Date.now();
        });
      if (expiredOpen && !autoClosingExpired && !busyAction && !phoneBidBusy) {
        autoClosingExpired = true;
        try {
          await runAction(expiredOpen.fairWarningAt ? 'close' : 'fair_warning', expiredOpen.id, { fairWarningKey: expiredOpen.fairWarningKey });
        } finally {
          autoClosingExpired = false;
        }
      }
    } catch (err) {
      errorMessage = err.message || ui("Failed to load control room");
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
        const relistMessage = data?.auction?.liveSettings?.relistUnsoldLotsAtEnd && !data?.auction?.liveSettings?.unsoldRelistRoundStartedAt
          ? ' Unsold eligible lots will be reoffered once in this auction before it finishes.' : '';
        if (!confirm(message + relistMessage)) {
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
        throw new Error(err.message || ui("Failed to {value0}", { value0: action }));
      }
      const result = await response.json().catch(() => ({}));
      actionSuccess =
        result.relistedCount
          ? ui(result.relistedCount === 1 ? '{count} unsold lot relisted for one extra round' : '{count} unsold lots relisted for one extra round', { count: result.relistedCount }) + ' ' + ui(result.nextLot ? '— first lot is open' : '— open the next lot when ready')
          : action === 'claim'
          ? 'You claimed the auctioneer seat'
          : action === 'start'
            ? 'Auction started — first lot is open'
            : action === 'open'
              ? 'Lot opened for bidding'
              : action === 'fair_warning'
                ? 'Fair warning — last chance to bid'
              : action === 'extend'
                ? ui('Added {seconds}s to the lot', { seconds: result.seconds || extra.seconds || defaultExtendSeconds })
                : action === 'end'
                  ? 'Auction ended'
                  : result.auctionEnded
                    ? 'Lot closed — auction finished'
                    : result.autoAdvanced
                      ? ui('Lot closed — next lot #{number} is on the block', { number: result.nextLot?.lotNumber || '' })
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
        throw new Error(err.message || ui("Failed to update auto-advance setting"));
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
    return new Intl.NumberFormat(uiLocale(), { style: 'currency', currency: (data?.auction?.currency || 'usd').toUpperCase() }).format(amount || 0);
  }

  function time(value) {
    return new Date(value).toLocaleTimeString(uiLocale(), { hour: 'numeric', minute: '2-digit', second: '2-digit' });
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

<div>
  <div class="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--pumbi-line)] bg-[var(--pumbi-forest-deep)] px-4 py-4 text-[#f7f4ee] sm:px-5">
    <div>
      <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d6b477]">{ui("Live floor")}</p>
      <p class="mt-1 text-sm text-[#bec9c4]">
        {#if data?.auction}
          {ui("Finished")} {data.finishedLots || 0} {ui("· Ready")} {data.remainingReadyLots || 0} {ui("· Approved bidders")} {data.registrations?.APPROVED || 0}
        {:else}
          {ui("Loading…")}
        {/if}
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      {#if canEndAuction}
        <button
          type="button"
          class="bg-[var(--pumbi-terracotta)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
          disabled={(Boolean(busyAction) || phoneBidBusy)}
          onclick={() => runAction('end')}
        >
          {busyAction.startsWith('end') ? ui("Ending…") : allLotsComplete ? ui("End auction") : ui("End auction early")}
        </button>
      {/if}
      <a href={`/auctions/${auctionId}`} class="border border-white/25 px-4 py-2 text-xs font-bold uppercase tracking-wide hover:bg-white/10" target="_blank" rel="noreferrer">{ui("Public live room")}</a>
    </div>
  </div>

  <div>
    {#if loading}
      <div class="pumbi-panel p-12 text-center text-[var(--pumbi-muted)]">
        <PumbiLoader size="lg" label={ui("Loading control room")} />
        <p class="mt-4">{ui("Loading control room…")}</p>
      </div>
    {:else if errorMessage}
      <div class="border border-red-200 bg-red-50 p-8 text-center text-red-700">{ui(errorMessage)}</div>
    {:else if data}
      {#if actionError}
        <div class="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{ui(actionError)}</div>
      {/if}
      {#if actionSuccess}
        <div class="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{ui(actionSuccess)}</div>
      {/if}

      <InterestTracker entityType="AUCTION" entityId={auctionId} />
      {#if data.auction.liveSettings?.unsoldRelistRoundStartedAt && !auctionEnded}
        <p class="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{ui("Unsold-lot round ·")} {data.auction.liveSettings.unsoldRelistCount} {ui("lots reoffered. This is the final round.")}</p>
      {/if}
      <AuctionActivity {auctionId} lotId={data.openLotId || data.onBlockLotId} />
      <div class="mb-5">
        {#key auctionId}
          <AuctionLiveVideo {auctionId} {overlay} publisher allowed={isAuctioneer && !auctionEnded} />
        {/key}
      </div>

      <div class="mb-5 grid gap-4 lg:grid-cols-3">
        <div class="pumbi-panel p-5">
          <p class="pumbi-eyebrow">{ui("Auctioneer seat")}</p>
          {#if !data.auction.auctioneerId}
            <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-xl font-semibold">{ui("Unclaimed")}</p>
            <button
              type="button"
              class="pumbi-btn mt-4 w-full disabled:opacity-60"
              disabled={(Boolean(busyAction) || phoneBidBusy)}
              onclick={() => runAction('claim')}
            >
              {busyAction.startsWith('claim') ? ui("Claiming…") : ui("Claim auctioneer seat")}
            </button>
          {:else if isAuctioneer}
            <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-xl font-semibold text-emerald-800">{ui("You are the auctioneer")}</p>
            <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">{ui("Only you can start lots and move the sale along.")}</p>
          {:else}
            <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-xl font-semibold text-amber-800">{ui("Seat taken")}</p>
            <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">{data.auction.auctioneer?.name || data.auction.auctioneer?.email || ui("Another team member")} {ui("is controlling this auction.")}</p>
          {/if}
        </div>

        <div class="pumbi-panel p-5 lg:col-span-2">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="pumbi-eyebrow">{ui("Auto-advance lots")}</p>
              <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-xl font-semibold">
                {autoAdvanceNextLot ? ui("On — next lot opens after hammer") : ui("Off — open each lot manually")}
              </p>
              <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">
                {ui("Default lives under Auction settings → Live Auction. Change it here while the sale is running.")}
              </p>
            </div>
            {#if isAuctioneer && !auctionEnded}
              <button
                type="button"
                class="px-4 py-3 text-sm font-bold text-white disabled:opacity-60 {autoAdvanceNextLot ? 'bg-[var(--pumbi-forest)]' : 'bg-[var(--pumbi-terracotta)]'}"
                disabled={(Boolean(busyAction) || phoneBidBusy)}
                onclick={() => setAutoAdvance(!autoAdvanceNextLot)}
              >
                {busyAction === 'settings:autoAdvance'
                  ? ui("Saving…")
                  : autoAdvanceNextLot
                    ? ui("Turn auto-advance off")
                    : ui("Turn auto-advance on")}
              </button>
            {:else if !isAuctioneer}
              <a href={data.settingsPath || `/seller/auctions/${auctionId}/settings`} class="pumbi-btn-secondary">
                {ui("Change in Settings")}
              </a>
            {/if}
          </div>
        </div>
      </div>

      <div class="mb-5 grid gap-4 lg:grid-cols-2">
        <div class="pumbi-panel p-5">
          <p class="pumbi-eyebrow">{ui("On the block")}</p>
          {#if openLot}
            <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-xl font-semibold">{ui("Lot #")}{openLot.lotNumber} · {openLot.title}</p>
            <p class="mt-1 text-2xl font-semibold text-[var(--pumbi-terracotta)]">{money(openLot.currentBid || openLot.startingBid)}</p>
            <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">
              {ui("High bidder:")} {openLot.highestBidderName || ui("None yet")}
            </p>
            {#if openLot.endTime}
              <p class="mt-2 text-sm font-semibold text-red-700">
                {ui("Time left:")} <CountdownTimer targetDate={openLot.endTime} label="" />
              </p>
              {#if autoAdvanceNextLot && new Date(openLot.endTime).getTime() <= Date.now()}
                <p class="mt-2 text-xs font-semibold text-amber-700">{ui("Timer expired — auto-advancing to the next lot…")}</p>
              {/if}
            {/if}
            {#if isAuctioneer && !auctionEnded}
              <div class="mt-4">
                <p class="text-xs font-bold uppercase tracking-wide text-[var(--pumbi-muted)]">{ui("Add time")}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  {#each extendPresets as seconds}
                    <button
                      type="button"
                      class="border border-[var(--pumbi-line)] bg-[var(--pumbi-cream-deep)] px-3 py-2 text-sm font-bold disabled:opacity-60"
                      disabled={(Boolean(busyAction) || phoneBidBusy)}
                      onclick={() => runAction('extend', openLot.id, { seconds })}
                    >
                      {busyAction.startsWith(`extend:${openLot.id}:${seconds}`) ? ui("Adding…") : `+${seconds}s`}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
            {#if isAuctioneer && !auctionEnded}
              {#key openLot.id}
                <PhoneBidForm currency={data?.auction?.currency || 'usd'} {auctionId} lot={openLot} disabled={Boolean(busyAction)} onbusychange={busy => { phoneBidBusy = busy; }} onrecorded={async result => {
                  actionSuccess = `Phone maximum saved · current bid ${money(result.currentBid)} · ${result.isLeading ? 'caller is leading' : 'caller was automatically outbid'}${result.newBuyer ? ' · new caller registered' : ''}`;
                  await refresh();
                }} />
              {/key}
            {/if}
            {#if openLot.fairWarningAt}<p role="status" class="mt-4 border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">{ui("Fair warning given. A new bid clears the warning.")}</p>{/if}
            <button
              type="button"
              class="mt-4 w-full bg-[var(--pumbi-terracotta)] px-4 py-3 font-bold text-white disabled:opacity-60"
              disabled={!isAuctioneer || (Boolean(busyAction) || phoneBidBusy)}
              onclick={() => runAction(openLot.fairWarningAt ? 'close' : 'fair_warning', openLot.id, { fairWarningKey: openLot.fairWarningKey })}
            >
              {busyAction.startsWith(`close:${openLot.id}`) ? ui("Closing…") : busyAction.startsWith(`fair_warning:${openLot.id}`) ? ui("Giving fair warning…") : !openLot.fairWarningAt ? ui("Fair warning") : openLot.highestBidderId ? ui("Hammer down · Mark sold") : ui("Hammer down · Mark unsold")}
            </button>
          {:else}
            <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-xl font-semibold">{ui("No lot open")}</p>
            <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">{ui("Open the next queued lot when you are ready.")}</p>
          {/if}
        </div>

        <div class="pumbi-panel p-5">
          <p class="pumbi-eyebrow">{ui("Next up")}</p>
          {#if nextLot}
            <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-xl font-semibold">{ui("Lot #")}{nextLot.lotNumber} · {nextLot.title}</p>
            <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">{ui("Start at")} {money(nextLot.startingBid)}</p>
            {#if !data.auction.auctioneerStartedAt}
              <button
                type="button"
                class="pumbi-btn mt-4 w-full disabled:opacity-60"
                disabled={!isAuctioneer || (Boolean(busyAction) || phoneBidBusy) || Boolean(openLot)}
                onclick={() => runAction('start', nextLot.id)}
              >
                {busyAction === `start:${nextLot.id}` ? ui("Starting…") : ui("Start auction on this lot")}
              </button>
            {:else}
              <button
                type="button"
                class="pumbi-btn mt-4 w-full disabled:opacity-60"
                disabled={!isAuctioneer || (Boolean(busyAction) || phoneBidBusy) || Boolean(openLot)}
                onclick={() => runAction('open', nextLot.id)}
              >
                {busyAction === `open:${nextLot.id}` ? ui("Opening…") : ui("Open this lot for bidding")}
              </button>
            {/if}
            {#if openLot}
              <p class="mt-2 text-xs font-semibold text-amber-700">{ui("Close the current lot before opening the next one.")}</p>
            {/if}
          {:else}
            <p class="mt-2 text-lg font-black text-slate-900">{ui("No queued lots")}</p>
            {#if auctionEnded}
              <p class="mt-1 text-sm text-slate-500">{ui("This auction is finished.")}</p>
            {:else if allLotsComplete}
              <p class="mt-1 text-sm text-slate-500">{ui("All ready lots are complete. End the auction to mark it finished.")}</p>
              <button
                type="button"
                class="mt-4 w-full rounded-xl bg-[#18372f] px-4 py-3 font-bold text-white hover:bg-[#152c26] disabled:opacity-60"
                disabled={!canEndAuction || (Boolean(busyAction) || phoneBidBusy)}
                onclick={() => runAction('end')}
              >
                {busyAction.startsWith('end') ? ui("Ending…") : ui("End auction")}
              </button>
            {:else}
              <p class="mt-1 text-sm text-slate-500">{ui("Mark lots ready in Manage Lots to queue them here.")}</p>
            {/if}
          {/if}
        </div>
      </div>

      {#if auctionEnded}
        <div class="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700">
          {ui("Auction status is")} <span class="uppercase">{uiStatus(data.auction.status)}</span>{ui(". The public room will no longer accept bids.")}
        </div>
      {:else if allLotsComplete && canEndAuction}
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ddd6ca] bg-[#efe8dc] px-5 py-4">
          <div>
            <p class="font-bold text-[#1a2821]">{ui("All lots are done")}</p>
            <p class="mt-1 text-sm text-[#435048]">{ui("Close the sale to set this auction to ended/finished.")}</p>
          </div>
          <button
            type="button"
            class="rounded-xl bg-[#18372f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#152c26] disabled:opacity-60"
            disabled={(Boolean(busyAction) || phoneBidBusy)}
            onclick={() => runAction('end')}
          >
            {busyAction.startsWith('end') ? ui("Ending…") : ui("End auction")}
          </button>
        </div>
      {/if}

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <section class="pumbi-panel overflow-hidden">
          <div class="border-b border-slate-200 px-5 py-4">
            <h2 class="font-black text-slate-900">{ui("Lot order")}</h2>
            <p class="text-xs text-slate-500">{ui("Open, close, and advance lots in catalog order")}</p>
          </div>
          <div class="max-h-[70vh] overflow-y-auto">
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-3">{ui("Lot")}</th>
                  <th class="px-4 py-3">{ui("Title")}</th>
                  <th class="px-4 py-3">{ui("Price")}</th>
                  <th class="px-4 py-3">{ui("State")}</th>
                  <th class="px-4 py-3 text-end">{ui("Actions")}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {#each data.lots as lot}
                  <tr class={lot.id === data.openLotId ? 'bg-[var(--pumbi-cream-deep)]' : ''}>
                    <td class="px-4 py-3 font-bold text-slate-900">#{lot.lotNumber}</td>
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-900">{lot.title}</p>
                      {#if lot.highestBidderName}
                        <p class="text-xs text-slate-500">{ui("High:")} {lot.highestBidderName}</p>
                      {/if}
                    </td>
                    <td class="px-4 py-3 font-semibold text-slate-800">{money(lot.currentBid || lot.startingBid)}</td>
                    <td class="px-4 py-3">
                      <span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{lotState(lot)}</span>
                    </td>
                    <td class="px-4 py-3 text-end">
                      <div class="flex flex-wrap justify-end gap-2">
                        {#if lot.id === data.openLotId}
                          <button
                            type="button"
                            class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            disabled={!isAuctioneer || (Boolean(busyAction) || phoneBidBusy)}
                            onclick={() => runAction('close', lot.id)}
                          >
                            {ui("Close")}
                          </button>
                        {:else if lot.status === 'ACTIVE' && lot.isReady}
                          {#if !data.auction.auctioneerStartedAt}
                            <button
                              type="button"
                              class="bg-[var(--pumbi-forest)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                              disabled={!isAuctioneer || (Boolean(busyAction) || phoneBidBusy) || Boolean(openLot)}
                              onclick={() => runAction('start', lot.id)}
                            >
                              {ui("Start here")}
                            </button>
                          {:else}
                            <button
                              type="button"
                              class="bg-[var(--pumbi-forest)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                              disabled={!isAuctioneer || (Boolean(busyAction) || phoneBidBusy) || Boolean(openLot)}
                              onclick={() => runAction('open', lot.id)}
                            >
                              {ui("Open")}
                            </button>
                          {/if}
                        {/if}
                        <a href={`/lots/${lot.id}`} class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" target="_blank" rel="noreferrer">{ui("View")}</a>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        <aside class="pumbi-panel overflow-hidden">
          <div class="border-b border-slate-200 px-5 py-4">
            <h2 class="font-black text-slate-900">{ui("Recent bids")}</h2>
            <p class="text-xs text-slate-500">{ui("Live feed across the auction")}</p>
          </div>
          {#if data.bids.length === 0}
            <p class="p-6 text-sm text-slate-500">{ui("No bids yet.")}</p>
          {:else}
            <div class="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {#each data.bids as bid}
                <div class="px-5 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate font-bold text-slate-900">{#if data.canViewBidderProfiles && bid.bidderId}<a class="underline underline-offset-4" target="_blank" rel="noopener" title={ui("Open bidder profile in a new tab")} href={`/seller/bidders/${bid.bidderId}?houseId=${data.auction.auctionHouse.id}`}>{bid.bidderName}</a>{:else}{bid.bidderName}{/if}{#if bid.isAutomatic}<span class="ms-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800">{ui("Auto")}</span>{/if}{#if bid.source === 'PHONE'}<span class="ms-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">{ui("Phone")}</span>{/if}</p>
                      <p class="truncate text-xs text-slate-500">{ui("Lot #")}{bid.lotNumber} · {bid.lotTitle}</p>
                    </div>
                    <div class="text-end">
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
