<script>
  import { onMount } from 'svelte';
  let { auctionId, lot, currency = 'usd', disabled = false, onrecorded, onbusychange = () => {} } = $props();
  let dialog = $state(null);
  let open = $state(false);
  let mode = $state('existing');
  let bidders = $state([]);
  let bidderId = $state('');
  let query = $state('');
  let searching = $state(false);
  let searchVersion = 0;
  let amount = $state('');
  let caller = $state({ name: '', email: '', phone: '' });
  let callerConfirmed = $state(false);
  let terms = $state('');
  let busy = $state(false);
  let errorMessage = $state('');
  let clock = $state(Date.now());
  let minimum = $derived(Math.round(Math.max(Number(lot.startingBid), Number(lot.currentBid) + Number(lot.bidIncrement)) * 100) / 100);
  let lotOpen = $derived(lot.status === 'ACTIVE' && lot.endTime && new Date(lot.endTime).getTime() > clock);
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(value || 0);
  const endpoint = $derived(`/api/auctions/${auctionId}/phone-bids`);

  async function search() {
    const version = ++searchVersion;
    searching = true; errorMessage = '';
    try {
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to load bidders');
      if (version === searchVersion) { bidders = result.bidders; terms = result.terms || ''; }
    } catch (err) { if (version === searchVersion) errorMessage = err.message; }
    finally { if (version === searchVersion) searching = false; }
  }
  function show() {
    open = true;
    errorMessage = ''; amount = minimum; callerConfirmed = false;
    dialog.showModal();
    search();
  }
  function close() {
    if (busy) return;
    open = false; ++searchVersion; dialog.close();
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    busy = true; onbusychange(true); errorMessage = '';
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotId: lot.id, mode, bidderId, caller: mode === 'new' ? caller : undefined, amount, callerConfirmed, acceptedTerms: terms })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to record phone bid');
      open = false; dialog.close();
      await onrecorded(result);
    } catch (err) { errorMessage = err.message; }
    finally { busy = false; onbusychange(false); }
  }
  onMount(() => {
    const timer = setInterval(() => { clock = Date.now(); }, 1000);
    return () => { clearInterval(timer); ++searchVersion; };
  });
</script>

<button type="button" class="pumbi-btn-secondary mt-4 w-full" disabled={disabled || !lotOpen} onclick={show}>+ Phone bid</button>

<dialog bind:this={dialog} oncancel={event => { event.preventDefault(); close(); }} class="w-[min(640px,calc(100%-32px))] max-h-[90dvh] rounded-xl border border-[var(--pumbi-line)] bg-[#f7f4ee] p-0 text-[#1a2821] shadow-2xl backdrop:bg-black/60" aria-label="Record phone bid">
  <header class="flex items-center justify-between gap-4 border-b border-[var(--pumbi-line)] px-5 py-4"><div><p class="pumbi-eyebrow">Phone bid · Lot #{lot.lotNumber}</p><h2 class="mt-1 text-xl font-semibold">{lot.title}</h2></div><button type="button" class="pumbi-btn-secondary" disabled={busy} onclick={close}>Close</button></header>
  {#if open}
    <form class="space-y-4 p-5" onsubmit={submit}>
      {#if errorMessage}<p role="alert" class="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>{/if}
      {#if !lotOpen}<p role="status" class="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This lot’s timer has expired. Extend or reopen the lot before recording a bid.</p>{/if}
      <div class="flex gap-2"><button type="button" class="border px-3 py-2 text-sm" class:selected={mode === 'existing'} aria-pressed={mode === 'existing'} disabled={busy} onclick={() => { mode = 'existing'; callerConfirmed = false; }}>Existing bidder</button><button type="button" class="border px-3 py-2 text-sm" class:selected={mode === 'new'} aria-pressed={mode === 'new'} disabled={busy} onclick={() => { mode = 'new'; callerConfirmed = false; }}>New caller</button></div>
      {#if mode === 'existing'}
        <div class="flex gap-2"><input class="min-w-0 flex-1 rounded border-[var(--pumbi-line)] text-sm" bind:value={query} disabled={busy} placeholder="Search name, email, or phone" aria-label="Find approved bidder" /><button type="button" class="pumbi-btn-secondary" disabled={busy || searching} onclick={search}>{searching ? 'Searching…' : 'Search'}</button></div>
        <label class="block text-sm font-semibold">Approved bidder<select bind:value={bidderId} required disabled={busy || searching} class="mt-1 w-full rounded border-[var(--pumbi-line)] text-sm"><option value="">Select the caller</option>{#each bidders as bidder}<option value={bidder.id}>{bidder.name || 'Unnamed bidder'} · {bidder.email}{bidder.id === lot.highestBidderId ? ' · current high bidder' : ''}</option>{/each}</select></label>
        {#if !searching && !bidders.length}<p class="text-xs text-[var(--pumbi-muted)]">No approved bidders match. Use New caller or review the auction’s bidder registrations.</p>{/if}
      {:else}
        <label class="block text-sm font-semibold">Caller name<input bind:value={caller.name} required maxlength="120" disabled={busy} class="mt-1 w-full rounded border-[var(--pumbi-line)] text-sm" autocomplete="name" /></label>
        <label class="block text-sm font-semibold">Email for invoices<input type="email" bind:value={caller.email} required maxlength="254" disabled={busy} class="mt-1 w-full rounded border-[var(--pumbi-line)] text-sm" autocomplete="email" /></label>
        <label class="block text-sm font-semibold">Phone number<input type="tel" bind:value={caller.phone} required maxlength="40" disabled={busy} class="mt-1 w-full rounded border-[var(--pumbi-line)] text-sm" autocomplete="tel" /></label>
        <p class="text-xs text-[var(--pumbi-muted)]">The caller will be registered for this auction. If their email already belongs to an account, that account is used without changing its contact details. Online verification remains separate.</p>
      {/if}
      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3"><label class="block text-sm font-semibold">Caller’s maximum bid (USD)<input type="number" min={minimum} step="0.01" bind:value={amount} required disabled={busy} class="mt-1 w-full rounded border-[var(--pumbi-line)] text-sm" /></label><button type="button" class="pumbi-btn-secondary" disabled={busy} onclick={() => amount = minimum}>Use {money(minimum)}</button></div>
      <p class="text-xs text-[var(--pumbi-muted)]">Minimum bid: {money(minimum)}. We bid only as much as needed to lead, up to this maximum. Another bidder’s higher maximum may immediately outbid the caller.</p>
      {#if terms}<details class="border border-[var(--pumbi-line)] bg-white p-3 text-sm"><summary class="cursor-pointer font-semibold">Auction terms to confirm with the caller</summary><p class="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-5">{terms}</p></details>{/if}
      <label class="flex items-start gap-3 text-sm"><input type="checkbox" bind:checked={callerConfirmed} required disabled={busy} class="mt-1 rounded border-[var(--pumbi-line)]" /><span>I confirm the caller’s identity, that they accept this auction’s terms, and that they authorize automatic bids up to this maximum.</span></label>
      <button type="submit" class="pumbi-btn w-full" disabled={busy || disabled || !lotOpen || !callerConfirmed}>{busy ? 'Recording…' : `Save phone maximum · ${money(amount)}`}</button>
    </form>
  {/if}
</dialog>

<style>.selected { background: #18372f; color: white; }</style>
