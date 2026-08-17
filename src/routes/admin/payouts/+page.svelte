<script>
  import { onMount } from 'svelte';

  let releases = $state([]);
  let loading = $state(true);
  let busy = $state('');
  let notice = $state('');
  let failure = $state('');
  let rejectionReasons = $state({});

  onMount(load);

  async function api(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
    return payload;
  }

  async function load() {
    loading = true;
    failure = '';
    try {
      releases = (await api('/api/admin/payout-releases')).releases;
    } catch (err) {
      failure = err.message;
    } finally {
      loading = false;
    }
  }

  async function act(item, action) {
    if (action === 'approve' && !window.confirm(`Release ${money(item)} to ${item.auctionHouse.name}?`)) return;
    busy = item.id;
    failure = '';
    notice = '';
    try {
      const body = action === 'reject'
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectionReasons[item.id] || '' }) }
        : {};
      await api(`/api/admin/payout-releases/${item.id}/${action}`, { method: 'POST', ...body });
      notice = action === 'approve' ? 'Payout released through Stripe.' : 'Payout release rejected.';
      await load();
    } catch (err) {
      failure = err.message;
    } finally {
      busy = '';
    }
  }

  function money(item) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: item.currency.toUpperCase()
    }).format(Number(item.amount));
  }
</script>

<svelte:head><title>Payout review | Pumbi</title></svelte:head>

<main class="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
  <div class="mx-auto max-w-6xl space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-indigo-600">Platform administration</p>
        <h1 class="text-3xl font-bold">Payout releases</h1>
        <p class="mt-1 text-sm text-slate-500">Review and release approved-house funds to Stripe Express accounts.</p>
      </div>
      <button class="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100" onclick={load}>Refresh</button>
    </header>

    {#if notice}<div class="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>{/if}
    {#if failure}<div class="rounded-md bg-red-50 p-3 text-sm text-red-800">{failure}</div>{/if}

    {#if loading}
      <p class="rounded-xl border bg-white p-10 text-center text-slate-500">Loading payout releases…</p>
    {:else}
      <section class="space-y-3">
        {#each releases as item}
          <article class="grid gap-4 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
            <div>
              <div class="flex flex-wrap items-center gap-2"><h2 class="font-bold">{item.auctionHouse.name}</h2><span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{item.status}</span></div>
              <p class="mt-2 text-xl font-bold">{money(item)}</p>
              <p class="mt-1 text-sm text-slate-700">{item.reason}</p>
              <p class="mt-2 text-xs text-slate-500">Reference: {item.sourceReference} · Requested by {item.requestedBy.name || item.requestedBy.email} · {new Date(item.requestedAt).toLocaleString()}</p>
              {#if item.stripeTransferId}<p class="mt-1 text-xs text-emerald-700">Stripe transfer: {item.stripeTransferId}</p>{/if}
              {#if item.stripeError}<p class="mt-1 text-xs text-red-700">{item.stripeError}</p>{/if}
            </div>
            {#if item.status === 'REQUESTED'}
              <div class="grid content-center gap-2">
                <button class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''} onclick={() => act(item, 'approve')}>Approve and transfer</button>
                <div class="flex gap-2">
                  <input class="min-w-0 flex-1 rounded-md border-slate-300 text-sm" maxlength="1000" placeholder="Required rejection reason" bind:value={rejectionReasons[item.id]} />
                  <button class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''} onclick={() => act(item, 'reject')}>Reject</button>
                </div>
              </div>
            {:else if item.status === 'PROCESSING'}
              <div class="grid content-center"><button class="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''} onclick={() => act(item, 'approve')}>Reconcile safely</button></div>
            {/if}
          </article>
        {/each}
        {#if releases.length === 0}<p class="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">No payout releases.</p>{/if}
      </section>
    {/if}
  </div>
</main>
