<script>
  import { onMount } from 'svelte';

  let { data } = $props();
  let connect = $state(null);
  let releases = $state([]);
  let loading = $state(true);
  let busy = $state('');
  let notice = $state('');
  let failure = $state('');
  let form = $state({ amount: '', currency: 'usd', sourceReference: '', reason: '' });

  const houseId = data.auctionHouse.id;

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
      connect = await api(`/api/auction-houses/${houseId}/connect`);
      releases = [];
      if (data.auctionHouse.onboardingStatus === 'APPROVED' && connect.payoutsEnabled) {
        releases = (await api(`/api/auction-houses/${houseId}/payout-releases`)).releases;
      }
    } catch (err) {
      failure = err.message;
    } finally {
      loading = false;
    }
  }

  async function onboard() {
    busy = 'connect';
    failure = '';
    try {
      const result = await api(`/api/auction-houses/${houseId}/connect`, { method: 'POST' });
      window.location.assign(result.onboardingUrl);
    } catch (err) {
      failure = err.message;
      busy = '';
    }
  }

  async function requestRelease() {
    busy = 'release';
    failure = '';
    notice = '';
    try {
      await api(`/api/auction-houses/${houseId}/payout-releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      form = { amount: '', currency: 'usd', sourceReference: '', reason: '' };
      notice = 'Payout release submitted for platform approval.';
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

<svelte:head><title>Banking and payouts | Pumbi</title></svelte:head>

<main class="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
  <div class="mx-auto max-w-4xl space-y-6">
    <header>
      <p class="text-xs font-semibold uppercase tracking-widest text-indigo-600">Seller operations</p>
      <h1 class="text-3xl font-bold">Banking and payouts</h1>
      <p class="mt-1 text-sm text-slate-500">{data.auctionHouse.name}</p>
    </header>

    {#if notice}<div class="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>{/if}
    {#if failure}<div class="rounded-md bg-red-50 p-3 text-sm text-red-800">{failure}</div>{/if}

    {#if loading}
      <p class="rounded-xl border bg-white p-8 text-center text-slate-500">Loading banking status…</p>
    {:else}
      <section class="rounded-xl border bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold">Stripe Express account</h2>
            <p class="mt-1 text-sm text-slate-600">
              Status: <strong>{connect?.status || 'NOT_CONNECTED'}</strong>
              · Details {connect?.detailsSubmitted ? 'submitted' : 'needed'}
              · Payouts {connect?.payoutsEnabled ? 'enabled' : 'disabled'}
            </p>
          </div>
          <button class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''} onclick={onboard}>
            {connect?.detailsSubmitted ? 'Update Stripe details' : 'Start Stripe onboarding'}
          </button>
        </div>
        <p class="mt-3 text-xs text-slate-500">Bank account, identity, and tax details are entered directly in Stripe and are never sent to Pumbi.</p>
      </section>

      {#if data.auctionHouse.onboardingStatus !== 'APPROVED'}
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Payout releases become available after auction-house approval.</div>
      {:else if !connect?.payoutsEnabled}
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Complete Stripe onboarding and resolve any Stripe requirements before requesting a release.</div>
      {:else}
        <form class="rounded-xl border bg-white p-5 shadow-sm" onsubmit={(event) => { event.preventDefault(); requestRelease(); }}>
          <h2 class="mb-4 text-lg font-bold">Request payout release</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="text-sm font-medium">Amount<input class="mt-1 w-full rounded-md border-slate-300" type="number" min="0.01" step="0.01" bind:value={form.amount} required /></label>
            <label class="text-sm font-medium">Currency<input class="mt-1 w-full rounded-md border-slate-300 uppercase" maxlength="3" bind:value={form.currency} required /></label>
            <label class="text-sm font-medium md:col-span-2">Source reference<input class="mt-1 w-full rounded-md border-slate-300" maxlength="200" placeholder="Internal settlement, auction, or invoice reference" bind:value={form.sourceReference} required /></label>
            <label class="text-sm font-medium md:col-span-2">Reason<textarea class="mt-1 w-full rounded-md border-slate-300" rows="3" maxlength="1000" bind:value={form.reason} required></textarea></label>
          </div>
          <button class="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''}>Submit for approval</button>
        </form>

        <section class="rounded-xl border bg-white p-5 shadow-sm">
          <h2 class="mb-4 text-lg font-bold">Release history</h2>
          <div class="space-y-3">
            {#each releases as item}
              <article class="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                <div><strong>{money(item)}</strong><p class="text-sm text-slate-600">{item.reason}</p><p class="text-xs text-slate-500">{item.sourceReference}</p></div>
                <div class="text-right"><span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{item.status}</span><p class="mt-1 text-xs text-slate-500">{new Date(item.requestedAt).toLocaleString()}</p></div>
              </article>
            {/each}
            {#if releases.length === 0}<p class="py-5 text-center text-sm text-slate-500">No payout releases requested.</p>{/if}
          </div>
        </section>
      {/if}
    {/if}
  </div>
</main>
