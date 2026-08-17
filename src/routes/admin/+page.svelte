<script>
  import { onMount } from 'svelte';

  let { data } = $props();
  let policies = $state([]);
  let series = $state([]);
  let submissions = $state([]);
  let publicAuctions = $state([]);
  let loading = $state(true);
  let busy = $state('');
  let notice = $state('');
  let failure = $state('');
  let selectedAuctions = $state({});
  let rejectionReasons = $state({});

  let policyForm = $state({
    buyerTerms: '',
    sellerTerms: '',
    auctionHouseTerms: '',
    buyerPremiumRate: '0.15',
    sellerCommissionRate: '0.10',
    rateConfig: ''
  });
  let seriesForm = $state(blankSeries());
  let editingSeriesId = $state(null);

  function blankSeries() {
    return {
      name: '',
      auctionType: 'PUBLIC',
      timezone: 'America/New_York',
      recurrenceDayOfMonth: 1,
      recurrenceLocalTime: '12:00',
      nextRunAt: '',
      submissionCutoffOffsetDays: 7,
      auctionStartOffsetMinutes: 20160,
      auctionDurationMinutes: 1440,
      registrationOpenOffsetDays: 14,
      registrationCloseOffsetMinutes: -1440,
      isActive: true
    };
  }

  onMount(loadAll);

  async function request(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
    return payload;
  }

  async function loadAll() {
    loading = true;
    failure = '';
    try {
      const [policyData, seriesData, submissionData] = await Promise.all([
        request('/api/admin/platform-policies'),
        request('/api/admin/auction-series'),
        request('/api/admin/lot-submissions')
      ]);
      policies = policyData;
      series = seriesData.series;
      submissions = submissionData.submissions;
      publicAuctions = submissionData.publicAuctions;
    } catch (error) {
      failure = error.message;
    } finally {
      loading = false;
    }
  }

  async function perform(key, work, success) {
    busy = key;
    failure = '';
    notice = '';
    try {
      await work();
      notice = success;
      await loadAll();
    } catch (error) {
      failure = error.message;
    } finally {
      busy = '';
    }
  }

  function createPolicy() {
    return perform('policy-new', async () => {
      await request('/api/admin/platform-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyForm)
      });
      policyForm = { buyerTerms: '', sellerTerms: '', auctionHouseTerms: '', buyerPremiumRate: '0.15', sellerCommissionRate: '0.10', rateConfig: '' };
    }, 'Policy version created.');
  }

  function activatePolicy(id) {
    return perform(`policy-${id}`, () => request(`/api/admin/platform-policies/${id}/activate`, { method: 'POST' }), 'Policy activated.');
  }

  function saveSeries() {
    const id = editingSeriesId;
    return perform('series-save', async () => {
      await request(id ? `/api/admin/auction-series/${id}` : '/api/admin/auction-series', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...seriesForm, nextRunAt: seriesForm.nextRunAt || null })
      });
      editingSeriesId = null;
      seriesForm = blankSeries();
    }, id ? 'Series updated.' : 'Series created.');
  }

  function editSeries(item) {
    editingSeriesId = item.id;
    seriesForm = {
      name: item.name,
      auctionType: item.auctionType,
      timezone: item.timezone,
      recurrenceDayOfMonth: item.recurrenceDayOfMonth,
      recurrenceLocalTime: item.recurrenceLocalTime,
      nextRunAt: item.nextRunAt ? datetimeLocalInZone(item.nextRunAt, item.timezone) : '',
      submissionCutoffOffsetDays: item.submissionCutoffOffsetDays,
      auctionStartOffsetMinutes: item.auctionStartOffsetMinutes,
      auctionDurationMinutes: item.auctionDurationMinutes,
      registrationOpenOffsetDays: item.registrationOpenOffsetDays,
      registrationCloseOffsetMinutes: item.registrationCloseOffsetMinutes,
      isActive: item.isActive
    };
    document.getElementById('series-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  function approveSubmission(item) {
    return perform(`submission-${item.id}`, () => request(`/api/admin/lot-submissions/${item.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auctionId: selectedAuctions[item.id] || null })
    }), 'Submission approved and lot created.');
  }

  function rejectSubmission(item) {
    return perform(`submission-${item.id}`, () => request(`/api/admin/lot-submissions/${item.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectionReasons[item.id] || '' })
    }), 'Submission rejected.');
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString() : 'Not scheduled';
  }

  function datetimeLocalInZone(value, timezone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(value)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
</script>

<svelte:head><title>Platform administration | Pumbi</title></svelte:head>

<main class="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
  <div class="mx-auto max-w-7xl space-y-8">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-indigo-600">Platform administration</p>
        <h1 class="text-3xl font-bold">Public / Private Auctions</h1>
        <p class="mt-1 text-sm text-slate-500">Signed in as {data.admin.name || data.admin.email}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <a class="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100" href="/admin/auction-houses">Auction-house reviews</a>
        <a class="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100" href="/admin/payouts">Payout approvals</a>
        <button class="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100" onclick={loadAll}>Refresh</button>
      </div>
    </header>

    {#if notice}<div class="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>{/if}
    {#if failure}<div class="rounded-md bg-red-50 p-3 text-sm text-red-800">{failure}</div>{/if}

    {#if loading}
      <p class="py-12 text-center text-slate-500">Loading platform operations…</p>
    {:else}
      <section class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <div class="rounded-xl border bg-white p-5 shadow-sm">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-bold">Policy versions</h2>
            <span class="text-xs text-slate-500">{policies.length} total</span>
          </div>
          <div class="max-h-80 space-y-2 overflow-auto">
            {#each policies as policy}
              <article class="rounded-lg border p-3">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <span class="font-semibold">Version {policy.version}</span>
                    <span class="ml-2 rounded-full px-2 py-0.5 text-xs {policy.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
                      {policy.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {#if !policy.isActive}
                    <button class="rounded bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={busy !== ''} onclick={() => activatePolicy(policy.id)}>Activate</button>
                  {/if}
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  Buyer premium {Number(policy.buyerPremiumRate) * 100}% · Seller commission {Number(policy.sellerCommissionRate) * 100}% · {formatDate(policy.effectiveFrom)}
                </p>
              </article>
            {/each}
          </div>
        </div>

        <form class="rounded-xl border bg-white p-5 shadow-sm" onsubmit={(event) => { event.preventDefault(); createPolicy(); }}>
          <h2 class="mb-4 text-lg font-bold">Create next policy</h2>
          <div class="grid gap-3">
            <label class="text-sm font-medium">Buyer terms<textarea class="mt-1 w-full rounded-md border-slate-300 text-sm" rows="3" bind:value={policyForm.buyerTerms} required></textarea></label>
            <label class="text-sm font-medium">Seller terms<textarea class="mt-1 w-full rounded-md border-slate-300 text-sm" rows="3" bind:value={policyForm.sellerTerms} required></textarea></label>
            <label class="text-sm font-medium">Auction house onboarding terms<textarea class="mt-1 w-full rounded-md border-slate-300 text-sm" rows="3" bind:value={policyForm.auctionHouseTerms} required></textarea></label>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-sm font-medium">Buyer rate<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="number" min="0" max="1" step="0.0001" bind:value={policyForm.buyerPremiumRate} required /></label>
              <label class="text-sm font-medium">Seller rate<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="number" min="0" max="1" step="0.0001" bind:value={policyForm.sellerCommissionRate} required /></label>
            </div>
            <label class="text-sm font-medium">Rate config JSON (optional)<textarea class="mt-1 w-full rounded-md border-slate-300 font-mono text-xs" rows="2" bind:value={policyForm.rateConfig}></textarea></label>
            <button class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''}>Create version</button>
          </div>
        </form>
      </section>

      <section class="rounded-xl border bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold">Monthly auction series</h2>
          <span class="text-xs text-slate-500">{series.length} configured</span>
        </div>
        <form id="series-form" class="mb-5 grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-4" onsubmit={(event) => { event.preventDefault(); saveSeries(); }}>
          <label class="text-sm font-medium md:col-span-2">Name<input class="mt-1 w-full rounded-md border-slate-300 text-sm" bind:value={seriesForm.name} required /></label>
          <label class="text-sm font-medium">Auction house<input class="mt-1 w-full rounded-md border-slate-300 bg-slate-100 text-sm" value="Pumbi" disabled /></label>
          <label class="text-sm font-medium">Type<input class="mt-1 w-full rounded-md border-slate-300 bg-slate-100 text-sm" value="PUBLIC" disabled /></label>
          <label class="text-sm font-medium">Timezone<input class="mt-1 w-full rounded-md border-slate-300 text-sm" bind:value={seriesForm.timezone} required /></label>
          <label class="text-sm font-medium">Day of month<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="number" min="1" max="31" bind:value={seriesForm.recurrenceDayOfMonth} required /></label>
          <label class="text-sm font-medium">Local time<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="time" bind:value={seriesForm.recurrenceLocalTime} required /></label>
          <label class="text-sm font-medium">Next generation run<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="datetime-local" bind:value={seriesForm.nextRunAt} /></label>
          <label class="text-sm font-medium">Submission cutoff (days)<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="number" min="0" bind:value={seriesForm.submissionCutoffOffsetDays} /></label>
          <label class="text-sm font-medium">Auction starts after generation (minutes)<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="number" min="1" bind:value={seriesForm.auctionStartOffsetMinutes} /></label>
          <label class="text-sm font-medium">Duration (minutes)<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="number" min="1" bind:value={seriesForm.auctionDurationMinutes} /></label>
          <label class="text-sm font-medium">Registration opens (days)<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="number" min="0" bind:value={seriesForm.registrationOpenOffsetDays} /></label>
          <label class="text-sm font-medium">Registration closes before start (minutes; negative is after)<input class="mt-1 w-full rounded-md border-slate-300 text-sm" type="number" bind:value={seriesForm.registrationCloseOffsetMinutes} /></label>
          <label class="flex items-center gap-2 self-end pb-2 text-sm font-medium"><input type="checkbox" bind:checked={seriesForm.isActive} /> Active</label>
          <div class="flex items-end gap-2 md:col-span-2">
            <button class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''}>{editingSeriesId ? 'Update series' : 'Create series'}</button>
            {#if editingSeriesId}<button type="button" class="rounded-md border bg-white px-3 py-2 text-sm" onclick={() => { editingSeriesId = null; seriesForm = blankSeries(); }}>Cancel</button>{/if}
          </div>
        </form>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b text-xs uppercase text-slate-500"><tr><th class="p-2">Series</th><th class="p-2">Schedule</th><th class="p-2">Activity</th><th class="p-2"></th></tr></thead>
            <tbody>
              {#each series as item}
                <tr class="border-b last:border-0">
                  <td class="p-2"><strong>{item.name}</strong><div class="text-xs text-slate-500">{item.auctionHouse.name} · {item.auctionType}</div></td>
                  <td class="p-2">Day {item.recurrenceDayOfMonth} at {item.recurrenceLocalTime}<div class="text-xs text-slate-500">{item.timezone} · next {formatDate(item.nextRunAt)}</div></td>
                  <td class="p-2">{item._count.auctions} auctions · {item._count.lotSubmissions} submissions<div class="text-xs {item.isActive ? 'text-emerald-700' : 'text-slate-500'}">{item.isActive ? 'Active' : 'Paused'}</div></td>
                  <td class="p-2 text-right"><button class="rounded border px-2 py-1 text-xs hover:bg-slate-50" onclick={() => editSeries(item)}>Edit</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-xl border bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold">Lot submissions</h2>
          <span class="text-xs text-slate-500">{submissions.filter((item) => item.status === 'SUBMITTED').length} awaiting review</span>
        </div>
        <div class="space-y-3">
          {#each submissions as item}
            <article class="grid gap-3 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="font-semibold">{item.title || 'Untitled submission'}</h3>
                  <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{item.status}</span>
                </div>
                <p class="mt-1 line-clamp-2 text-sm text-slate-600">{item.description || 'No description'}</p>
                <p class="mt-2 text-xs text-slate-500">
                  {item.sellerProfile.displayName || item.sellerProfile.user.name || item.sellerProfile.user.email}
                  · Start {item.requestedStartingBid ?? '—'} · Increment {item.requestedBidIncrement ?? '—'}
                  {#if item.auctionSeries}· {item.auctionSeries.name}{/if}
                </p>
                {#if item.rejectionReason}<p class="mt-2 text-xs text-red-700">Reason: {item.rejectionReason}</p>{/if}
                {#if item.approvedLot}<p class="mt-2 text-xs text-emerald-700">Created lot #{item.approvedLot.lotNumber}</p>{/if}
              </div>
              {#if item.status === 'SUBMITTED'}
                <div class="grid gap-2">
                  <select class="w-full rounded-md border-slate-300 text-sm" bind:value={selectedAuctions[item.id]}>
                    <option value="">Use the next generated series auction</option>
                    {#each publicAuctions as auction}<option value={auction.id}>{auction.title} — {formatDate(auction.startDate)}</option>{/each}
                  </select>
                  <div class="flex gap-2">
                    <button class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''} onclick={() => approveSubmission(item)}>Approve</button>
                    <input class="min-w-0 flex-1 rounded-md border-slate-300 text-sm" placeholder="Rejection reason" bind:value={rejectionReasons[item.id]} />
                    <button class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== ''} onclick={() => rejectSubmission(item)}>Reject</button>
                  </div>
                </div>
              {/if}
            </article>
          {/each}
          {#if submissions.length === 0}<p class="py-8 text-center text-sm text-slate-500">No lot submissions.</p>{/if}
        </div>
      </section>
    {/if}
  </div>
</main>
