<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let policies = $state([]);
  let series = $state([]);
  let submissions = $state([]);
  let publicAuctions = $state([]);
  let auctions = $state([]);
  let loading = $state(true);
  let busy = $state('');
  let notice = $state('');
  let failure = $state('');
  let selectedAuctions = $state({});
  let rejectionReasons = $state({});
  let showManualAuctionForm = $state(false);
  let manualAuctionForm = $state(blankManualAuction());

  let policyForm = $state({
    buyerTerms: '',
    sellerTerms: '',
    auctionHouseTerms: '',
    buyerPremiumRate: '0.15',
    sellerCommissionRate: '0.10',
    rateConfig: '',
  });
  let seriesForm = $state(blankSeries());
  let editingSeriesId = $state(null);

  function blankManualAuction() {
    return {
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      imageUrl: '',
    };
  }

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
      isActive: true,
    };
  }

  onMount(() => {
    showManualAuctionForm = $page.url.searchParams.has('create');
    loadAll();
  });

  async function request(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        payload.message ||
          payload.error ||
          ui("Request failed ({value0})", { value0: response.status }),
      );
    return payload;
  }

  async function loadAll() {
    loading = true;
    failure = '';
    try {
      const [auctionData, policyData, seriesData, submissionData] =
        await Promise.all([
          request('/api/admin/auctions'),
          request('/api/admin/platform-policies'),
          request('/api/admin/auction-series'),
          request('/api/admin/lot-submissions'),
        ]);
      auctions = auctionData.auctions;
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
    return perform(
      'policy-new',
      async () => {
        await request('/api/admin/platform-policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(policyForm),
        });
        policyForm = {
          buyerTerms: '',
          sellerTerms: '',
          auctionHouseTerms: '',
          buyerPremiumRate: '0.15',
          sellerCommissionRate: '0.10',
          rateConfig: '',
        };
      },
      'Policy version created.',
    );
  }

  function createManualAuction() {
    return perform(
      'auction-new',
      async () => {
        await request('/api/admin/auctions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...manualAuctionForm,
            startDate: new Date(manualAuctionForm.startDate).toISOString(),
            endDate: new Date(manualAuctionForm.endDate).toISOString(),
          }),
        });
        manualAuctionForm = blankManualAuction();
        showManualAuctionForm = false;
      },
      'Public auction created.',
    );
  }

  function activatePolicy(id) {
    return perform(
      `policy-${id}`,
      () =>
        request(`/api/admin/platform-policies/${id}/activate`, {
          method: 'POST',
        }),
      'Policy activated.',
    );
  }

  function saveSeries() {
    const id = editingSeriesId;
    return perform(
      'series-save',
      async () => {
        await request(
          id ? `/api/admin/auction-series/${id}` : '/api/admin/auction-series',
          {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...seriesForm,
              nextRunAt: seriesForm.nextRunAt || null,
            }),
          },
        );
        editingSeriesId = null;
        seriesForm = blankSeries();
      },
      id ? 'Series updated.' : 'Series created.',
    );
  }

  function editSeries(item) {
    editingSeriesId = item.id;
    seriesForm = {
      name: item.name,
      auctionType: item.auctionType,
      timezone: item.timezone,
      recurrenceDayOfMonth: item.recurrenceDayOfMonth,
      recurrenceLocalTime: item.recurrenceLocalTime,
      nextRunAt: item.nextRunAt
        ? datetimeLocalInZone(item.nextRunAt, item.timezone)
        : '',
      submissionCutoffOffsetDays: item.submissionCutoffOffsetDays,
      auctionStartOffsetMinutes: item.auctionStartOffsetMinutes,
      auctionDurationMinutes: item.auctionDurationMinutes,
      registrationOpenOffsetDays: item.registrationOpenOffsetDays,
      registrationCloseOffsetMinutes: item.registrationCloseOffsetMinutes,
      isActive: item.isActive,
    };
    document
      .getElementById('series-form')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  function approveSubmission(item) {
    return perform(
      `submission-${item.id}`,
      () =>
        request(`/api/admin/lot-submissions/${item.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auctionId: selectedAuctions[item.id] || null,
          }),
        }),
      'Submission approved and lot created.',
    );
  }

  function rejectSubmission(item) {
    return perform(
      `submission-${item.id}`,
      () =>
        request(`/api/admin/lot-submissions/${item.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectionReasons[item.id] || '' }),
        }),
      'Submission rejected.',
    );
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString(uiLocale()) : ui("Not scheduled");
  }

  function submissionCondition(item) {
    try {
      return item.metaFields ? JSON.parse(item.metaFields).condition || '' : '';
    } catch {
      return '';
    }
  }

  function activePolicy() {
    const now = Date.now();
    return policies.find(
      (policy) =>
        policy.isActive &&
        new Date(policy.effectiveFrom).getTime() <= now &&
        (!policy.effectiveTo || new Date(policy.effectiveTo).getTime() > now),
    );
  }

  function datetimeLocalInZone(value, timezone) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(value))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
</script>

<svelte:head><title>{ui("Auction operations | Pumbi Admin")}</title></svelte:head>

<div class="text-slate-900">
  <div class="mx-auto max-w-7xl space-y-8">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p
          class="text-xs font-semibold uppercase tracking-widest text-indigo-600"
        >
          {ui("Catalog operations")}
        </p>
        <h1 class="text-3xl font-bold">{ui("Auction operations")}</h1>
        <p class="mt-1 text-sm text-slate-500">
          {ui("Manage public auction policy, schedules, and submitted lots.")}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <a
          href="/admin/auctions"
          class="rounded-md border bg-white px-3 py-2 text-sm font-medium text-indigo-700"
        >
          {ui("Browse all auctions")}
        </a>
        <button
          class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          onclick={() => (showManualAuctionForm = !showManualAuctionForm)}
        >
          {showManualAuctionForm ? ui("Close form") : ui("+ Create auction")}
        </button>
        <button
          class="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
          onclick={loadAll}
        >
          {ui("Refresh")}
        </button>
      </div>
    </header>

    {#if notice}<div
        class="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800"
      >
        {ui(notice)}
      </div>{/if}
    {#if failure}<div class="rounded-md bg-red-50 p-3 text-sm text-red-800">
        {ui(failure)}
      </div>{/if}

    {#if loading}
      <p class="py-12 text-center text-slate-500">
        {ui("Loading platform operations…")}
      </p>
    {:else}
      {#if showManualAuctionForm}
        <section
          class="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm"
        >
          <div class="border-b border-indigo-100 bg-indigo-50 px-5 py-4">
            <p
              class="text-xs font-bold uppercase tracking-widest text-indigo-600"
            >
              {ui("Standalone public auction")}
            </p>
            <h2 class="mt-1 text-xl font-bold">{ui("Create an auction now")}</h2>
            <p class="mt-1 text-sm text-slate-600">
              {ui("Owned by Pumbi and governed by the active platform policy. This does not create or change a recurring series.")}
            </p>
            {#if activePolicy()}
              <p class="mt-2 text-xs font-semibold text-emerald-700">
                {ui("Active policy: version")} {activePolicy().version}
              </p>
            {:else}
              <p class="mt-2 text-xs font-semibold text-amber-800">
                {ui("Create and activate a platform policy below before publishing an auction.")}
              </p>
            {/if}
          </div>
          <form
            class="grid gap-4 p-5 md:grid-cols-2"
            onsubmit={(event) => {
              event.preventDefault();
              createManualAuction();
            }}
          >
            <label class="text-sm font-medium md:col-span-2">
              {ui("Title")}<input
                class="mt-1 w-full rounded-md border-slate-300 text-sm"
                maxlength="200"
                bind:value={manualAuctionForm.title}
                required
              />
            </label>
            <label class="text-sm font-medium md:col-span-2">
              {ui("Description")}<textarea
                class="mt-1 w-full rounded-md border-slate-300 text-sm"
                maxlength="5000"
                rows="3"
                bind:value={manualAuctionForm.description}></textarea>
            </label>
            <label class="text-sm font-medium">
              {ui("Starts")}<input
                class="mt-1 w-full rounded-md border-slate-300 text-sm"
                type="datetime-local"
                bind:value={manualAuctionForm.startDate}
                required
              />
            </label>
            <label class="text-sm font-medium">
              {ui("Ends")}<input
                class="mt-1 w-full rounded-md border-slate-300 text-sm"
                type="datetime-local"
                bind:value={manualAuctionForm.endDate}
                required
              />
            </label>
            <label class="text-sm font-medium md:col-span-2">
              {ui("Cover image URL")} <span class="font-normal text-slate-400">
                {ui("(optional)")}
              </span><input
                class="mt-1 w-full rounded-md border-slate-300 text-sm"
                type="url"
                maxlength="2000"
                placeholder="https://…"
                bind:value={manualAuctionForm.imageUrl}
              />
            </label>
            <div
              class="flex flex-wrap items-center justify-between gap-3 border-t pt-4 md:col-span-2"
            >
              <p class="text-xs text-slate-500">
                {ui("A future start creates an UPCOMING auction; an earlier start creates a LIVE auction.")}
              </p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="rounded-md border px-4 py-2 text-sm font-semibold"
                  onclick={() => {
                    manualAuctionForm = blankManualAuction();
                    showManualAuctionForm = false;
                  }}
                >
                  {ui("Cancel")}
                </button>
                <button
                  class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={busy !== '' || !activePolicy()}
                >
                  {busy === 'auction-new'
                    ? ui("Creating…")
                    : ui("Create public auction")}
                </button>
              </div>
            </div>
          </form>
        </section>
      {/if}

      <section class="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        >
          <div>
            <h2 class="text-lg font-bold">{ui("Public auctions")}</h2>
            <p class="text-xs text-slate-500">
              {ui("Standalone and recurring auction occurrences")}
            </p>
          </div>
          <span class="text-xs text-slate-500">{auctions.length} {ui("shown")}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-start text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-5 py-3">{ui("Auction")}</th><th class="px-5 py-3">
                  {ui("Source")}
                </th><th class="px-5 py-3">{ui("Status")}</th><th class="px-5 py-3">
                  {ui("Schedule")}
                </th><th class="px-5 py-3">{ui("Activity")}</th><th class="px-5 py-3"
                ></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each auctions as auction}
                <tr class="hover:bg-slate-50">
                  <td class="px-5 py-4 font-semibold">
                    {auction.title}
                    <div class="text-xs font-normal text-slate-500">
                      {ui("Policy v")}{auction.policyVersionSnapshot || '—'}
                    </div>
                  </td>
                  <td class="px-5 py-4">
                    <span
                      class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold"
                    >
                      {auction.seriesId ? ui("Recurring") : ui("Manual")}
                    </span>
                  </td>
                  <td class="px-5 py-4">{uiStatus(auction.status)}</td>
                  <td class="px-5 py-4 text-xs text-slate-600">
                    {formatDate(auction.startDate)}<br />{ui("to")} {formatDate(
                      auction.endDate,
                    )}
                  </td>
                  <td class="px-5 py-4 text-slate-600">
                    {auction._count.lots} {ui("lots ·")} {auction._count.registrations} {ui("bidders")}
                  </td>
                  <td class="px-5 py-4 text-end">
                    <a
                      href={`/auctions/${auction.id}`}
                      class="font-semibold text-indigo-600"
                    >
                      {ui("Open →")}
                    </a>
                  </td>
                </tr>
              {/each}
              {#if auctions.length === 0}<tr>
                  <td colspan="6" class="px-5 py-10 text-center text-slate-500">
                    {ui("No public auctions yet. Create the first one above.")}
                  </td>
                </tr>{/if}
            </tbody>
          </table>
        </div>
      </section>

      <section
        class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]"
      >
        <div class="rounded-xl border bg-white p-5 shadow-sm">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-bold">{ui("Policy versions")}</h2>
            <span class="text-xs text-slate-500">{policies.length} {ui("total")}</span>
          </div>
          <div class="max-h-80 space-y-2 overflow-auto">
            {#each policies as policy}
              <article class="rounded-lg border p-3">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <span class="font-semibold">{ui("Version")} {policy.version}</span>
                    <span
                      class="ms-2 rounded-full px-2 py-0.5 text-xs {policy.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'}"
                    >
                      {policy.isActive ? ui("Active") : ui("Inactive")}
                    </span>
                  </div>
                  {#if !policy.isActive}
                    <button
                      class="rounded bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      disabled={busy !== ''}
                      onclick={() => activatePolicy(policy.id)}
                    >
                      {ui("Activate")}
                    </button>
                  {/if}
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  {ui("Buyer premium")} {Number(policy.buyerPremiumRate) * 100}{ui("% · Seller commission")} {Number(policy.sellerCommissionRate) * 100}%
                  · {formatDate(policy.effectiveFrom)}
                </p>
              </article>
            {/each}
          </div>
        </div>

        <form
          class="rounded-xl border bg-white p-5 shadow-sm"
          onsubmit={(event) => {
            event.preventDefault();
            createPolicy();
          }}
        >
          <h2 class="mb-4 text-lg font-bold">{ui("Create next policy")}</h2>
          <div class="grid gap-3">
            <label class="text-sm font-medium">
              {ui("Buyer terms")}<textarea
                class="mt-1 w-full rounded-md border-slate-300 text-sm"
                rows="3"
                bind:value={policyForm.buyerTerms}
                required></textarea>
            </label>
            <label class="text-sm font-medium">
              {ui("Seller terms")}<textarea
                class="mt-1 w-full rounded-md border-slate-300 text-sm"
                rows="3"
                bind:value={policyForm.sellerTerms}
                required></textarea>
            </label>
            <label class="text-sm font-medium">
              {ui("Auction house onboarding terms")}<textarea
                class="mt-1 w-full rounded-md border-slate-300 text-sm"
                rows="3"
                bind:value={policyForm.auctionHouseTerms}
                required></textarea>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-sm font-medium">
                {ui("Buyer rate")}<input
                  class="mt-1 w-full rounded-md border-slate-300 text-sm"
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  bind:value={policyForm.buyerPremiumRate}
                  required
                />
              </label>
              <label class="text-sm font-medium">
                {ui("Seller rate")}<input
                  class="mt-1 w-full rounded-md border-slate-300 text-sm"
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  bind:value={policyForm.sellerCommissionRate}
                  required
                />
              </label>
            </div>
            <label class="text-sm font-medium">
              {ui("Rate config JSON (optional)")}<textarea
                class="mt-1 w-full rounded-md border-slate-300 font-mono text-xs"
                rows="2"
                bind:value={policyForm.rateConfig}></textarea>
            </label>
            <button
              class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy !== ''}
            >
              {ui("Create version")}
            </button>
          </div>
        </form>
      </section>

      <section class="rounded-xl border bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold">{ui("Monthly auction series")}</h2>
          <span class="text-xs text-slate-500">{series.length} {ui("configured")}</span>
        </div>
        <form
          id="series-form"
          class="mb-5 grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-4"
          onsubmit={(event) => {
            event.preventDefault();
            saveSeries();
          }}
        >
          <label class="text-sm font-medium md:col-span-2">
            {ui("Name")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              bind:value={seriesForm.name}
              required
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Auction house")}<input
              class="mt-1 w-full rounded-md border-slate-300 bg-slate-100 text-sm"
              value="Pumbi"
              disabled
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Type")}<input
              class="mt-1 w-full rounded-md border-slate-300 bg-slate-100 text-sm"
              value="PUBLIC"
              disabled
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Timezone")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              bind:value={seriesForm.timezone}
              required
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Day of month")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              type="number"
              min="1"
              max="31"
              bind:value={seriesForm.recurrenceDayOfMonth}
              required
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Local time")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              type="time"
              bind:value={seriesForm.recurrenceLocalTime}
              required
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Next generation run")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              type="datetime-local"
              bind:value={seriesForm.nextRunAt}
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Submission cutoff (days)")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              type="number"
              min="0"
              bind:value={seriesForm.submissionCutoffOffsetDays}
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Auction starts after generation (minutes)")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              type="number"
              min="1"
              bind:value={seriesForm.auctionStartOffsetMinutes}
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Duration (minutes)")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              type="number"
              min="1"
              bind:value={seriesForm.auctionDurationMinutes}
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Registration opens (days)")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              type="number"
              min="0"
              bind:value={seriesForm.registrationOpenOffsetDays}
            />
          </label>
          <label class="text-sm font-medium">
            {ui("Registration closes before start (minutes; negative is after)")}<input
              class="mt-1 w-full rounded-md border-slate-300 text-sm"
              type="number"
              bind:value={seriesForm.registrationCloseOffsetMinutes}
            />
          </label>
          <label
            class="flex items-center gap-2 self-end pb-2 text-sm font-medium"
          >
            <input type="checkbox" bind:checked={seriesForm.isActive} /> {ui("Active")}
          </label>
          <div class="flex items-end gap-2 md:col-span-2">
            <button
              class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy !== ''}
            >
              {editingSeriesId ? ui("Update series") : ui("Create series")}
            </button>
            {#if editingSeriesId}<button
                type="button"
                class="rounded-md border bg-white px-3 py-2 text-sm"
                onclick={() => {
                  editingSeriesId = null;
                  seriesForm = blankSeries();
                }}
              >
                {ui("Cancel")}
              </button>{/if}
          </div>
        </form>
        <div class="overflow-x-auto">
          <table class="w-full text-start text-sm">
            <thead class="border-b text-xs uppercase text-slate-500">
              <tr>
                <th class="p-2">{ui("Series")}</th><th class="p-2">{ui("Schedule")}</th><th
                  class="p-2"
                >
                  {ui("Activity")}
                </th><th class="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {#each series as item}
                <tr class="border-b last:border-0">
                  <td class="p-2">
                    <strong>{item.name}</strong>
                    <div class="text-xs text-slate-500">
                      {item.auctionHouse.name} · {item.auctionType}
                    </div>
                  </td>
                  <td class="p-2">
                    {ui("Day")} {item.recurrenceDayOfMonth} {ui("at")} {item.recurrenceLocalTime}
                    <div class="text-xs text-slate-500">
                      {item.timezone} {ui("· next")} {formatDate(item.nextRunAt)}
                    </div>
                  </td>
                  <td class="p-2">
                    {item._count.auctions} {ui("auctions ·")} {item._count
                      .lotSubmissions} {ui("submissions")}
                    <div
                      class="text-xs {item.isActive
                        ? 'text-emerald-700'
                        : 'text-slate-500'}"
                    >
                      {item.isActive ? ui("Active") : ui("Paused")}
                    </div>
                  </td>
                  <td class="p-2 text-end">
                    <button
                      class="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                      onclick={() => editSeries(item)}
                    >
                      {ui("Edit")}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="lot-submissions"
        class="rounded-xl border bg-white p-5 shadow-sm"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold">{ui("Lot submissions")}</h2>
          <span class="text-xs text-slate-500">
            {submissions.filter((item) => item.status === 'SUBMITTED').length} {ui("awaiting review")}
          </span>
        </div>
        <div class="space-y-3">
          {#each submissions as item}
            <article
              class="grid gap-3 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]"
            >
              <div class="flex gap-3">
                {#if item.images?.[0]}<img
                    src={item.images[0].previewUrl}
                    alt={item.title || ui("Lot submission")}
                    class="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />{/if}
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-semibold">
                      {item.title || ui("Untitled submission")}
                    </h3>
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {uiStatus(item.status)}
                    </span>
                  </div>
                  <p class="mt-1 line-clamp-2 text-sm text-slate-600">
                    {item.description || ui("No description")}
                  </p>
                  {#if submissionCondition(item)}<p
                      class="mt-2 text-xs text-slate-600"
                    >
                      <strong>{ui("Condition:")}</strong>
                      {submissionCondition(item)}
                    </p>{/if}
                  <p class="mt-2 text-xs text-slate-500">
                    {item.sellerProfile.displayName ||
                      item.sellerProfile.user.name ||
                      item.sellerProfile.user.email}
                    {ui("· Start")} {item.requestedStartingBid ?? '—'} {ui("· Increment")} {item.requestedBidIncrement ??
                      '—'}
                    {#if item.auctionSeries}· {item.auctionSeries.name}{/if}
                  </p>
                  {#if item.rejectionReason}<p
                      class="mt-2 text-xs text-red-700"
                    >
                      {ui("Reason:")} {item.rejectionReason}
                    </p>{/if}
                  {#if item.approvedLot}<p
                      class="mt-2 text-xs text-emerald-700"
                    >
                      {ui("Created lot #")}{item.approvedLot.lotNumber}
                    </p>{/if}
                </div>
              </div>
              {#if item.status === 'SUBMITTED'}
                <div class="grid gap-2">
                  <select
                    class="w-full rounded-md border-slate-300 text-sm"
                    bind:value={selectedAuctions[item.id]}
                  >
                    <option value="">
                      {ui("Use the next generated series auction")}
                    </option>
                    {#each publicAuctions as auction}<option value={auction.id}>
                        {auction.title} — {formatDate(auction.startDate)}
                      </option>{/each}
                  </select>
                  <div class="flex gap-2">
                    <button
                      class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={busy !== ''}
                      onclick={() => approveSubmission(item)}
                    >
                      {ui("Approve")}
                    </button>
                    <input
                      class="min-w-0 flex-1 rounded-md border-slate-300 text-sm"
                      placeholder={ui("Rejection reason")}
                      bind:value={rejectionReasons[item.id]}
                    />
                    <button
                      class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={busy !== ''}
                      onclick={() => rejectSubmission(item)}
                    >
                      {ui("Reject")}
                    </button>
                  </div>
                </div>
              {/if}
            </article>
          {/each}
          {#if submissions.length === 0}<p
              class="py-8 text-center text-sm text-slate-500"
            >
              {ui("No lot submissions.")}
            </p>{/if}
        </div>
      </section>
    {/if}
  </div>
</div>
