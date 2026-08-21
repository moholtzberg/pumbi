<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let loading = $state(true);
  let busy = $state(false);
  let imageBusy = $state(false);
  let profileOpen = $state(false);
  let message = $state('');
  let problem = $state('');
  let profile = $state({ displayName: '', legalName: '', contactEmail: '', contactPhone: '', address: '' });
  let submissions = $state([]);
  let opportunities = $state({ series: [], auctions: [] });
  let policy = $state(null);
  let editingId = $state(null);
  let acceptedTerms = $state(false);
  let lot = $state(emptyLot());
  let profileReady = $derived(Boolean(profile.displayName && profile.legalName && profile.contactEmail && profile.contactPhone && profile.address));

  function emptyLot() {
    return {
      title: '', description: '', condition: '', category: '',
      requestedStartingBid: '', requestedBidIncrement: '', opportunity: '', images: []
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
      const [profileData, submissionData] = await Promise.all([api('/api/seller-profile'), api('/api/lot-submissions')]);
      const current = profileData.profile;
      profile = {
        displayName: current?.displayName || '', legalName: current?.legalName || '',
        contactEmail: current?.contactEmail || '', contactPhone: current?.contactPhone || '', address: current?.address || ''
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
      await api('/api/seller-profile', { method: 'PUT', body: JSON.stringify(profile) });
      message = 'Seller details saved.';
      profileOpen = false;
    } catch (err) {
      problem = err.message;
    } finally {
      busy = false;
    }
  }

  async function createFromImage(file) {
    if (!file) return;
    imageBusy = true;
    clearNotices();
    try {
      const formData = new FormData();
      formData.set('image', file);
      const response = await fetch('/api/lot-submissions/analyze-image', {
        method: 'POST', credentials: 'include', body: formData
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.error || 'Could not create a listing from this image');

      lot.title = result.listing.title || lot.title;
      lot.description = result.listing.description || lot.description;
      lot.condition = result.listing.condition || lot.condition;
      lot.category = result.listing.category || lot.category;
      lot.images = [...lot.images, result.image].slice(0, 8);
      message = 'AI created a draft from your photo. Review every field before saving.';
      document.getElementById('lot-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      problem = err.message;
    } finally {
      imageBusy = false;
    }
  }

  function submissionBody() {
    const [kind, id] = lot.opportunity.split(':');
    return {
      title: lot.title,
      description: lot.description,
      condition: lot.condition,
      category: lot.category,
      requestedStartingBid: lot.requestedStartingBid,
      requestedBidIncrement: lot.requestedBidIncrement,
      auctionSeriesId: kind === 'series' ? id : null,
      auctionId: kind === 'auction' ? id : null,
      images: lot.images.map((image) => ({ key: image.key }))
    };
  }

  async function saveLot(submitAfter = false) {
    busy = true;
    clearNotices();
    try {
      if (!profileReady) throw new Error('Complete your seller details before creating a lot.');
      if (!lot.opportunity) throw new Error('Choose a public auction opportunity.');
      if (submitAfter && !acceptedTerms) throw new Error('Accept the seller terms before submitting.');
      const saved = await api(editingId ? `/api/lot-submissions/${editingId}` : '/api/lot-submissions', {
        method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(submissionBody())
      });

      if (submitAfter) {
        if (!policy) throw new Error('No active seller policy is currently available.');
        await api(`/api/lot-submissions/${saved.submission.id}/submit`, {
          method: 'POST', body: JSON.stringify({ acceptedTerms: true, policyId: policy.id, policyVersion: policy.version })
        });
        message = 'Lot submitted to Pumbi for review.';
        startNew(false);
      } else {
        message = 'Draft saved.';
        editingId = saved.submission.id;
        lot.images = saved.submission.images || lot.images;
      }
      await refreshSubmissions();
    } catch (err) {
      problem = err.message;
    } finally {
      busy = false;
    }
  }

  async function refreshSubmissions() {
    const data = await api('/api/lot-submissions');
    submissions = data.submissions;
    opportunities = data.opportunities;
    policy = data.policy;
  }

  function editSubmission(item) {
    editingId = item.id;
    acceptedTerms = false;
    lot = {
      title: item.title || '', description: item.description || '', condition: item.condition || '', category: item.category || '',
      requestedStartingBid: item.requestedStartingBid || '', requestedBidIncrement: item.requestedBidIncrement || '',
      opportunity: item.auctionSeriesId ? `series:${item.auctionSeriesId}` : `auction:${item.auctionId}`,
      images: item.images || []
    };
    clearNotices();
    document.getElementById('lot-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  function startNew(clear = true) {
    editingId = null;
    acceptedTerms = false;
    lot = emptyLot();
    if (clear) clearNotices();
  }

  function clearNotices() { message = ''; problem = ''; }
  function ratePercent(rate) { return `${(Number(rate) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`; }
  function formatDate(value) { return value ? new Date(value).toLocaleString() : 'Schedule to be announced'; }
</script>

<svelte:head><title>Create a lot | Pumbi</title></svelte:head>

<main class="min-h-screen bg-slate-50 py-8">
  <div class="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><a href="/dashboard" class="text-sm font-semibold text-violet-700">← Dashboard</a><p class="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Seller workspace</p><h1 class="mt-1 text-3xl font-black text-slate-950">Create a lot</h1><p class="mt-1 text-sm text-slate-500">Start with a photo or enter the catalog details yourself.</p></div>
      <div class="flex flex-wrap gap-2"><a href="/dashboard/sell/bulk" class="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-5 py-3 font-bold text-violet-700 shadow-sm transition hover:bg-violet-50">Bulk CSV / Grid</a><button type="button" onclick={() => document.getElementById('ai-image')?.click()} disabled={imageBusy || !profileReady} class="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">✦</span>{imageBusy ? 'Reading image…' : 'Create from image'}</button></div>
      <input id="ai-image" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onchange={(event) => createFromImage(event.currentTarget.files?.[0])} />
    </header>

    {#if problem}<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{problem}</div>{/if}
    {#if message}<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</div>{/if}

    {#if loading}
      <div class="rounded-2xl border bg-white py-20 text-center text-slate-500">Loading seller workspace…</div>
    {:else}
      <section class="rounded-2xl border bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 p-5">
          <div class="flex items-center gap-3"><span class="grid h-9 w-9 place-items-center rounded-full {profileReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">{profileReady ? '✓' : '!'}</span><div><h2 class="font-bold text-slate-950">Seller details</h2><p class="text-sm text-slate-500">{profileReady ? `${profile.displayName} · ready to submit` : 'Complete these details before saving a lot'}</p></div></div>
          <button type="button" onclick={() => profileOpen = !profileOpen} class="rounded-lg border px-3 py-2 text-sm font-semibold">{profileOpen ? 'Close' : profileReady ? 'Edit details' : 'Complete details'}</button>
        </div>
        {#if profileOpen}
          <form class="grid gap-4 border-t bg-slate-50 p-5 sm:grid-cols-2" onsubmit={(event) => { event.preventDefault(); saveProfile(); }}>
            <label class="text-sm font-semibold">Display name<input required class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.displayName} /></label>
            <label class="text-sm font-semibold">Legal name<input required class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.legalName} /></label>
            <label class="text-sm font-semibold">Contact email<input required type="email" class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.contactEmail} /></label>
            <label class="text-sm font-semibold">Contact phone<input required class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.contactPhone} /></label>
            <label class="text-sm font-semibold sm:col-span-2">Address<textarea required rows="2" class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.address}></textarea></label>
            <div class="sm:col-span-2"><button disabled={busy} class="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-50">Save details</button></div>
          </form>
        {/if}
      </section>

      <section id="lot-form" class="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h2 class="text-xl font-black">{editingId ? 'Edit lot draft' : 'New lot draft'}</h2><p class="text-sm text-slate-500">AI suggestions are a starting point—review them for accuracy.</p></div>{#if editingId}<button type="button" onclick={() => startNew()} class="text-sm font-bold text-violet-700">Start new</button>{/if}</div>

        <form class="grid gap-6 p-5 lg:grid-cols-[280px_minmax(0,1fr)]" onsubmit={(event) => { event.preventDefault(); saveLot(false); }}>
          <div>
            {#if lot.images.length}
              <div class="space-y-3">{#each lot.images as image, index}<div class="overflow-hidden rounded-xl border bg-slate-100"><img src={image.previewUrl || image.url} alt={`Listing reference ${index + 1}`} class="aspect-square w-full object-cover" /></div>{/each}<button type="button" onclick={() => document.getElementById('ai-image')?.click()} disabled={imageBusy || lot.images.length >= 8} class="w-full rounded-lg border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700 disabled:opacity-50">+ Analyze another photo</button></div>
            {:else}
              <button type="button" onclick={() => document.getElementById('ai-image')?.click()} disabled={imageBusy || !profileReady} class="grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-violet-200 bg-violet-50 p-6 text-center text-violet-800 disabled:opacity-50"><span><span class="block text-4xl">✦</span><strong class="mt-3 block">Create from image</strong><span class="mt-1 block text-sm text-violet-600">Take a photo or choose one. AI will draft the listing.</span></span></button>
            {/if}
            <p class="mt-3 text-xs leading-5 text-slate-500">JPEG, PNG, or WebP · 12 MB max. Images are stored securely in Pumbi’s S3 bucket.</p>
          </div>

          <div class="space-y-4">
            <label class="block text-sm font-semibold">Title<input required maxlength="200" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.title} /></label>
            <label class="block text-sm font-semibold">Description<textarea rows="5" maxlength="10000" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.description}></textarea></label>
            <label class="block text-sm font-semibold">Condition<textarea rows="3" maxlength="2000" placeholder="Visible wear, damage, completeness, repairs, or uncertainty" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.condition}></textarea></label>
            <div class="grid gap-4 sm:grid-cols-3">
              <label class="text-sm font-semibold">Category<input maxlength="100" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.category} /></label>
              <label class="text-sm font-semibold">Starting bid<input type="number" min="0" step="0.01" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.requestedStartingBid} /></label>
              <label class="text-sm font-semibold">Bid increment<input type="number" min="0" step="0.01" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.requestedBidIncrement} /></label>
            </div>
            <label class="block text-sm font-semibold">Public auction<select required class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.opportunity}><option value="">Choose a series or auction</option>{#each opportunities.series as series}<option value={`series:${series.id}`}>{series.name} — monthly, next {formatDate(series.nextRunAt)}</option>{/each}{#each opportunities.auctions as auction}<option value={`auction:${auction.id}`}>{auction.title} — {formatDate(auction.startDate)}</option>{/each}</select></label>

            {#if policy}
              <details class="rounded-xl border border-blue-200 bg-blue-50 p-4"><summary class="cursor-pointer font-bold text-blue-950">Pumbi seller terms · {ratePercent(policy.sellerCommissionRate)} commission</summary><div class="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-700">{policy.sellerTerms}</div><label class="mt-3 flex items-start gap-2 text-sm font-semibold text-blue-950"><input type="checkbox" class="mt-1 rounded" bind:checked={acceptedTerms} /><span>I accept version {policy.version} of the Pumbi seller terms and rates.</span></label></details>
            {:else}<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No active seller policy is published. You can save drafts, but submitting is temporarily unavailable.</div>{/if}

            <div class="flex flex-wrap gap-3"><button type="submit" disabled={busy || imageBusy} class="rounded-lg border px-4 py-2 font-bold disabled:opacity-50">Save draft</button><button type="button" disabled={busy || imageBusy || !policy || !acceptedTerms} onclick={() => saveLot(true)} class="rounded-lg bg-violet-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Submit for review</button></div>
          </div>
        </form>
      </section>

      <section class="rounded-2xl border bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><div><h2 class="text-xl font-black">Your submissions</h2><p class="text-sm text-slate-500">Drafts and review progress</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{submissions.length}</span></div>{#if submissions.length === 0}<div class="py-10 text-center text-sm text-slate-500">You have not created any lot submissions yet.</div>{:else}<div class="mt-5 grid gap-3 md:grid-cols-2">{#each submissions as item}<article class="flex gap-4 rounded-xl border p-4">{#if item.images?.[0]}<img src={item.images[0].previewUrl} alt={item.title || 'Lot submission'} class="h-20 w-20 shrink-0 rounded-lg object-cover" />{:else}<div class="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-slate-100 text-2xl text-slate-300">◇</div>{/if}<div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><h3 class="truncate font-bold">{item.title || 'Untitled draft'}</h3><span class={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : item.status === 'REJECTED' ? 'bg-red-100 text-red-800' : item.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>{item.status}</span></div><p class="mt-1 truncate text-xs text-slate-500">{item.auctionSeries?.name || item.auction?.title || 'Opportunity unavailable'}</p>{#if item.rejectionReason}<p class="mt-2 text-xs text-red-700">{item.rejectionReason}</p>{/if}<div class="mt-3 flex gap-3 text-xs"><span class="text-slate-400">Updated {formatDate(item.updatedAt)}</span>{#if item.status === 'DRAFT' || item.status === 'REJECTED'}<button type="button" class="font-bold text-violet-700" onclick={() => editSubmission(item)}>Edit</button>{/if}</div></div></article>{/each}</div>{/if}</section>
    {/if}
  </div>
</main>
