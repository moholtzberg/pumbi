<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let loading = $state(true);
  let busy = $state(false);
  let message = $state('');
  let problem = $state('');
  let profile = $state({
    displayName: '',
    legalName: '',
    contactEmail: '',
    contactPhone: '',
    address: ''
  });
  let submissions = $state([]);
  let opportunities = $state({ series: [], auctions: [] });
  let policy = $state(null);
  let editingId = $state(null);
  let acceptedTerms = $state(false);
  let lot = $state(emptyLot());

  function emptyLot() {
    return {
      title: '',
      description: '',
      category: '',
      requestedStartingBid: '',
      requestedBidIncrement: '',
      opportunity: ''
    };
  }

  async function api(url, options) {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: options?.body ? { 'Content-Type': 'application/json', ...options.headers } : options?.headers
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      goto('/auth/login');
      throw new Error('Please log in to sell');
    }
    if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  onMount(load);

  async function load() {
    loading = true;
    problem = '';
    try {
      const [profileData, submissionData] = await Promise.all([
        api('/api/seller-profile'),
        api('/api/lot-submissions')
      ]);
      const current = profileData.profile;
      profile = {
        displayName: current?.displayName || '',
        legalName: current?.legalName || '',
        contactEmail: current?.contactEmail || '',
        contactPhone: current?.contactPhone || '',
        address: current?.address || ''
      };
      submissions = submissionData.submissions;
      opportunities = submissionData.opportunities;
      policy = submissionData.policy;
    } catch (err) {
      problem = err.message;
    } finally {
      loading = false;
    }
  }

  async function saveProfile() {
    busy = true;
    clearNotices();
    try {
      await api('/api/seller-profile', {
        method: 'PUT',
        body: JSON.stringify(profile)
      });
      message = 'Seller profile saved.';
      await load();
    } catch (err) {
      problem = err.message;
    } finally {
      busy = false;
    }
  }

  function submissionBody() {
    const [kind, id] = lot.opportunity.split(':');
    return {
      title: lot.title,
      description: lot.description,
      category: lot.category,
      requestedStartingBid: lot.requestedStartingBid,
      requestedBidIncrement: lot.requestedBidIncrement,
      auctionSeriesId: kind === 'series' ? id : null,
      auctionId: kind === 'auction' ? id : null
    };
  }

  async function saveLot(submitAfter = false) {
    busy = true;
    clearNotices();
    try {
      if (!lot.opportunity) throw new Error('Choose a public auction opportunity.');
      if (submitAfter && !acceptedTerms) throw new Error('Accept the seller terms before submitting.');

      const saved = await api(
        editingId ? `/api/lot-submissions/${editingId}` : '/api/lot-submissions',
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(submissionBody())
        }
      );

      if (submitAfter) {
        if (!policy) throw new Error('No active seller policy is currently available.');
        await api(`/api/lot-submissions/${saved.submission.id}/submit`, {
          method: 'POST',
          body: JSON.stringify({
            acceptedTerms: true,
            policyId: policy.id,
            policyVersion: policy.version
          })
        });
        message = 'Lot submitted to Pumbi for review.';
        startNew();
      } else {
        message = 'Draft saved.';
        editingId = saved.submission.id;
      }
      await load();
    } catch (err) {
      problem = err.message;
    } finally {
      busy = false;
    }
  }

  function editSubmission(item) {
    editingId = item.id;
    acceptedTerms = false;
    lot = {
      title: item.title || '',
      description: item.description || '',
      category: item.category || '',
      requestedStartingBid: item.requestedStartingBid || '',
      requestedBidIncrement: item.requestedBidIncrement || '',
      opportunity: item.auctionSeriesId
        ? `series:${item.auctionSeriesId}`
        : `auction:${item.auctionId}`
    };
    clearNotices();
    document.getElementById('lot-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  function startNew() {
    editingId = null;
    acceptedTerms = false;
    lot = emptyLot();
  }

  function clearNotices() {
    message = '';
    problem = '';
  }

  function ratePercent(rate) {
    return `${(Number(rate) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString() : 'Schedule to be announced';
  }
</script>

<svelte:head>
  <title>Sell with Pumbi</title>
</svelte:head>

<main class="min-h-screen bg-slate-50 py-10">
  <div class="mx-auto max-w-5xl space-y-8 px-4">
    <div>
      <a href="/dashboard" class="text-sm font-medium text-blue-700 hover:text-blue-900">← Dashboard</a>
      <h1 class="mt-3 text-3xl font-bold text-slate-900">Sell with Pumbi</h1>
      <p class="mt-2 text-slate-600">Submit an item independently for a public monthly auction.</p>
    </div>

    {#if problem}
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{problem}</div>
    {/if}
    {#if message}
      <div class="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{message}</div>
    {/if}

    {#if loading}
      <div class="py-16 text-center text-slate-600">Loading seller workspace…</div>
    {:else}
      <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-xl font-semibold text-slate-900">Seller profile</h2>
        <p class="mt-1 text-sm text-slate-600">These details let Pumbi contact you about submitted lots.</p>
        <form class="mt-5 grid gap-4 sm:grid-cols-2" onsubmit={(event) => { event.preventDefault(); saveProfile(); }}>
          <label class="text-sm font-medium text-slate-700">
            Display name
            <input class="mt-1 w-full rounded-lg border-slate-300" bind:value={profile.displayName} />
          </label>
          <label class="text-sm font-medium text-slate-700">
            Legal name
            <input class="mt-1 w-full rounded-lg border-slate-300" bind:value={profile.legalName} />
          </label>
          <label class="text-sm font-medium text-slate-700">
            Contact email
            <input type="email" class="mt-1 w-full rounded-lg border-slate-300" bind:value={profile.contactEmail} />
          </label>
          <label class="text-sm font-medium text-slate-700">
            Contact phone
            <input class="mt-1 w-full rounded-lg border-slate-300" bind:value={profile.contactPhone} />
          </label>
          <label class="text-sm font-medium text-slate-700 sm:col-span-2">
            Address
            <textarea rows="2" class="mt-1 w-full rounded-lg border-slate-300" bind:value={profile.address}></textarea>
          </label>
          <div class="sm:col-span-2">
            <button disabled={busy} class="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
              Save seller profile
            </button>
          </div>
        </form>
      </section>

      <section id="lot-form" class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-slate-900">{editingId ? 'Edit submission' : 'Create a lot submission'}</h2>
            <p class="mt-1 text-sm text-slate-600">Save a draft, then accept the current terms when you are ready.</p>
          </div>
          {#if editingId}
            <button type="button" onclick={startNew} class="text-sm font-semibold text-blue-700">Start new</button>
          {/if}
        </div>

        <form class="mt-5 space-y-4" onsubmit={(event) => { event.preventDefault(); saveLot(false); }}>
          <label class="block text-sm font-medium text-slate-700">
            Title
            <input required maxlength="200" class="mt-1 w-full rounded-lg border-slate-300" bind:value={lot.title} />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            Description
            <textarea rows="5" maxlength="10000" class="mt-1 w-full rounded-lg border-slate-300" bind:value={lot.description}></textarea>
          </label>
          <div class="grid gap-4 sm:grid-cols-3">
            <label class="text-sm font-medium text-slate-700">
              Category
              <input maxlength="100" class="mt-1 w-full rounded-lg border-slate-300" bind:value={lot.category} />
            </label>
            <label class="text-sm font-medium text-slate-700">
              Requested starting bid
              <input type="number" min="0" step="0.01" class="mt-1 w-full rounded-lg border-slate-300" bind:value={lot.requestedStartingBid} />
            </label>
            <label class="text-sm font-medium text-slate-700">
              Requested bid increment
              <input type="number" min="0" step="0.01" class="mt-1 w-full rounded-lg border-slate-300" bind:value={lot.requestedBidIncrement} />
            </label>
          </div>
          <label class="block text-sm font-medium text-slate-700">
            Public auction opportunity
            <select required class="mt-1 w-full rounded-lg border-slate-300" bind:value={lot.opportunity}>
              <option value="">Choose a series or auction</option>
              {#each opportunities.series as series}
                <option value={`series:${series.id}`}>{series.name} — monthly, next {formatDate(series.nextRunAt)}</option>
              {/each}
              {#each opportunities.auctions as auction}
                <option value={`auction:${auction.id}`}>{auction.title} — {formatDate(auction.startDate)}</option>
              {/each}
            </select>
          </label>

          {#if policy}
            <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div class="font-semibold text-blue-950">Pumbi seller terms · version {policy.version}</div>
              <div class="mt-1 text-sm text-blue-900">
                Seller commission rate: <strong>{ratePercent(policy.sellerCommissionRate)}</strong>
              </div>
              <div class="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded bg-white p-3 text-sm text-slate-700">{policy.sellerTerms}</div>
              <label class="mt-4 flex items-start gap-2 text-sm font-medium text-blue-950">
                <input type="checkbox" class="mt-1 rounded border-slate-300" bind:checked={acceptedTerms} />
                <span>I have read and explicitly accept these Pumbi seller terms and rates.</span>
              </label>
            </div>
          {:else}
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Submitting is temporarily unavailable because no active Pumbi seller policy is published. You can still save a draft.
            </div>
          {/if}

          <div class="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} class="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 disabled:opacity-50">
              Save draft
            </button>
            <button
              type="button"
              disabled={busy || !policy || !acceptedTerms}
              onclick={() => saveLot(true)}
              class="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit for review
            </button>
          </div>
        </form>
      </section>

      <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-xl font-semibold text-slate-900">Your submissions</h2>
        {#if submissions.length === 0}
          <p class="mt-4 text-slate-600">You have not created any lot submissions yet.</p>
        {:else}
          <div class="mt-4 space-y-3">
            {#each submissions as item}
              <article class="rounded-lg border border-slate-200 p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 class="font-semibold text-slate-900">{item.title || 'Untitled draft'}</h3>
                    <p class="mt-1 text-sm text-slate-600">
                      {item.auctionSeries?.name || item.auction?.title || 'Opportunity unavailable'}
                    </p>
                  </div>
                  <span class={`rounded-full px-3 py-1 text-xs font-bold ${
                    item.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    item.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    item.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>{item.status}</span>
                </div>
                {#if item.rejectionReason}
                  <div class="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                    <strong>Review feedback:</strong> {item.rejectionReason}
                  </div>
                {/if}
                <div class="mt-3 flex items-center gap-4 text-sm text-slate-600">
                  <span>Updated {formatDate(item.updatedAt)}</span>
                  {#if item.status === 'DRAFT' || item.status === 'REJECTED'}
                    <button type="button" class="font-semibold text-blue-700" onclick={() => editSubmission(item)}>Edit</button>
                  {/if}
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </div>
</main>
