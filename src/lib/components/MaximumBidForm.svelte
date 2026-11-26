<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { minimumLotBid, lotBidIncrement } from '$lib/utils/bidIncrements.js';
  import { onMount } from 'svelte';
  let { lot, userId, currency = lot?.auction?.currency || 'usd', canBid = true, onbid = async () => {} } = $props();
  let maximum = $state(null);
  let amount = $state('');
  let busy = $state(false);
  let loadingMaximum = $state(true);
  let message = $state('');
  let problem = $state('');
  let leading = $derived(lot.highestBidderId === userId);
  let nextBid = $derived(minimumLotBid(lot));
  let minimum = $derived(leading ? Math.round((Math.max(Number(lot.currentBid), maximum || 0) + 0.01) * 100) / 100 : nextBid);
  const money = value => new Intl.NumberFormat(uiLocale(), { style: 'currency', currency: currency.toUpperCase() }).format(value || 0);
  let version = 0;
  async function loadMaximum() {
    if (busy) return;
    const currentVersion = ++version;
    const id = lot.id;
    try {
      const response = await fetch(`/api/bids?view=maximum&lotId=${encodeURIComponent(id)}`, { credentials: 'include' });
      if (!response.ok) throw new Error(ui("Unable to load your maximum bid. Please refresh."));
      const result = await response.json();
      if (currentVersion === version && lot.id === id) maximum = result.maximumBid;
    } catch (err) { if (currentVersion === version && !busy) problem = err.message; }
    finally { if (currentVersion === version) loadingMaximum = false; }
  }
  onMount(() => {
    loadMaximum();
    const timer = setInterval(loadMaximum, 5000);
    return () => { clearInterval(timer); ++version; };
  });
  async function submit(value) {
    if (busy || !canBid) return;
    busy = true; problem = ''; message = '';
    ++version; // An older status poll cannot overwrite this submission's new maximum.
    const id = lot.id;
    try {
      const response = await fetch('/api/bids', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lotId: id, amount: value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || ui("Unable to set maximum bid"));
      if (id === lot.id) {
        maximum = result.maximumBid; amount = '';
        message = result.maxUpdatedOnly
          ? ui("Your maximum is now {value0}. The public price stays at {value1}.", { value0: money(result.maximumBid), value1: money(result.currentBid) })
          : result.isLeading ? ui("You’re leading at {value0}. Your private maximum is {value1}.", { value0: money(result.currentBid), value1: money(result.maximumBid) })
          : ui("You were automatically outbid. The current bid is {value0}. Increase your maximum to try again.", { value0: money(result.currentBid) });
      }
      await onbid(result);
    } catch (err) { if (id === lot.id) problem = err.message; }
    finally { busy = false; loadingMaximum = false; }
  }
</script>

<div class="mt-4 space-y-3 text-[#1a2821]">
  {#if maximum !== null}<p class="rounded border border-[#d5d8cf] bg-white/80 p-3 text-sm"><strong>{ui("Your private maximum:")} {money(maximum)}</strong><span class="ms-1">· {leading ? (String(lot.status).toUpperCase() === 'SOLD' ? ui("Won") : ui("Leading")) : ui("Outbid")}</span></p>{/if}
  {#if problem}<p role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{ui(problem)}</p>{/if}
  {#if message}<p role="status" class="rounded border border-[#c5d0c8] bg-[#e8eee9] p-3 text-sm font-semibold text-[#18372f]">{ui(message)}</p>{/if}
  <form class="space-y-3" onsubmit={event => { event.preventDefault(); submit(amount); }}>
    <label class="block text-sm font-bold">{leading ? ui("Increase your maximum bid") : ui("Your maximum bid ({currency})", { currency: currency.toUpperCase() })}<input type="number" min={minimum} step="0.01" required bind:value={amount} placeholder={String(minimum)} disabled={busy || !canBid || loadingMaximum} class="mt-2 w-full rounded-sm border border-[#c9cfc8] bg-white px-3 py-3 text-base text-[#1a2821]" /></label>
    <p class="text-xs leading-5 text-[#526058]">{ui("The current increment is")} {money(lotBidIncrement(lot))}{ui(". It follows the configured price tiers as bidding rises. We bid only as much as needed to lead, up to your maximum. Equal maximums go to the earlier bidder. Your maximum is private and can only be increased while bidding is open.")}</p>
    <button class="w-full bg-[#18372f] px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy || !canBid || loadingMaximum}>{busy ? ui("Saving maximum…") : leading ? ui("Increase maximum") : ui("Set maximum & bid")}</button>
  </form>
  {#if !leading}<button type="button" class="w-full rounded-sm border border-[#c9cfc8] bg-white px-4 py-3 text-sm font-bold text-[#18372f] disabled:opacity-50" disabled={busy || !canBid || loadingMaximum} onclick={() => submit(nextBid)}>{ui("Bid")} {money(nextBid)} {ui("only")}</button>{/if}
  {#if !canBid}<p class="text-xs text-[#526058]">{['SOLD', 'UNSOLD', 'WITHDRAWN'].includes(String(lot.status).toUpperCase()) ? ui("This lot is closed.") : ui("Bidding is closed. Wait for the auctioneer to open or extend this lot.")}</p>{/if}
</div>
