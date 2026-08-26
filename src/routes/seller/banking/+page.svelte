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

<main class="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
  <div class="space-y-6">
    <header>
      <p class="pumbi-eyebrow">Payouts</p>
      <h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">Banking</h1>
      <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">{data.auctionHouse.name}</p>
    </header>

    {#if notice}<div class="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>{/if}
    {#if failure}<div class="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{failure}</div>{/if}

    {#if loading}
      <p class="pumbi-panel p-8 text-center text-[var(--pumbi-muted)]">Loading banking status…</p>
    {:else}
      <section class="pumbi-panel p-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Stripe Express account</h2>
            <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">
              Status: <strong>{connect?.status || 'NOT_CONNECTED'}</strong>
              · Details {connect?.detailsSubmitted ? 'submitted' : 'needed'}
              · Payouts {connect?.payoutsEnabled ? 'enabled' : 'disabled'}
            </p>
          </div>
          <button class="pumbi-btn" disabled={busy !== ''} onclick={onboard}>
            {connect?.detailsSubmitted ? 'Update Stripe details' : 'Start Stripe onboarding'}
          </button>
        </div>
        <p class="mt-3 text-xs text-[var(--pumbi-muted)]">Bank account, identity, and tax details are entered directly in Stripe and are never sent to Pumbi.</p>
      </section>

      {#if data.auctionHouse.onboardingStatus !== 'APPROVED'}
        <div class="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Payout releases become available after auction-house approval.</div>
      {:else if !connect?.payoutsEnabled}
        <div class="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Complete Stripe onboarding and resolve any Stripe requirements before requesting a release.</div>
      {:else}
        <form class="pumbi-panel p-5" onsubmit={(event) => { event.preventDefault(); requestRelease(); }}>
          <h2 class="mb-4 font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Request payout release</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="text-sm font-medium">Amount<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" type="number" min="0.01" step="0.01" bind:value={form.amount} required /></label>
            <label class="text-sm font-medium">Currency<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2 uppercase" maxlength="3" bind:value={form.currency} required /></label>
            <label class="text-sm font-medium md:col-span-2">Source reference<input class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" maxlength="200" placeholder="Internal settlement, auction, or invoice reference" bind:value={form.sourceReference} required /></label>
            <label class="text-sm font-medium md:col-span-2">Reason<textarea class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" rows="3" maxlength="1000" bind:value={form.reason} required></textarea></label>
          </div>
          <button class="pumbi-btn mt-4" disabled={busy !== ''}>Submit for approval</button>
        </form>

        <section class="pumbi-panel p-5">
          <h2 class="mb-4 font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Release history</h2>
          <div class="space-y-3">
            {#each releases as item}
              <article class="flex flex-wrap items-start justify-between gap-3 border border-[var(--pumbi-line)] p-3">
                <div><strong>{money(item)}</strong><p class="text-sm text-[var(--pumbi-ink-soft)]">{item.reason}</p><p class="text-xs text-[var(--pumbi-muted)]">{item.sourceReference}</p></div>
                <div class="text-right"><span class="bg-[var(--pumbi-cream-deep)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide">{item.status}</span><p class="mt-1 text-xs text-[var(--pumbi-muted)]">{new Date(item.requestedAt).toLocaleString()}</p></div>
              </article>
            {/each}
            {#if releases.length === 0}<p class="py-5 text-center text-sm text-[var(--pumbi-muted)]">No payout releases requested.</p>{/if}
          </div>
        </section>
      {/if}
    {/if}
  </div>
</main>
