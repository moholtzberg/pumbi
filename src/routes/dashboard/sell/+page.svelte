<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import { translate } from '$lib/i18n.js';
  import { page } from '$app/stores';
  const t = (text, values) => translate($page.data.locale || 'en', text, values);

  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { SUBMISSION_CATEGORIES, defaultSubmissionOpportunity, sellerContactComplete } from '$lib/utils/lotSubmission.js';
  import { analyzeListingPhoto, uploadImageForm } from '$lib/utils/imageUpload.js';

  let loading = $state(true);
  let busy = $state(false);
  let imageBusy = $state(false);
  let profileOpen = $state(false);
  let message = $state('');
  let problem = $state('');
  let profileSaved = $state(false);
  let profile = $state({ displayName: '', legalName: '', contactEmail: '', contactPhone: '', address: '' });
  let submissions = $state([]);
  let opportunities = $state({ series: [], auctions: [] });
  let categories = $state([...SUBMISSION_CATEGORIES]);
  let customCategory = $state(false);
  let hasOpportunities = $derived(opportunities.series.length + opportunities.auctions.length > 0);
  let categoryChoice = $derived(customCategory || (lot.category && !categories.includes(lot.category)) ? '__custom__' : lot.category);
  let policy = $state(null);
  let editingId = $state(null);
  let acceptedTerms = $state(false);
  let lot = $state(emptyLot());
  let profileReady = $derived(sellerContactComplete(profile));

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
      throw new Error(ui("Please log in to sell"));
    }
    if (!response.ok) throw new Error(data.message || data.error || ui("Request failed"));
    return data;
  }

  onMount(load);

  async function load() {
    loading = true;
    problem = '';
    try {
      const [profileData, submissionData] = await Promise.all([api('/api/seller-profile'), api('/api/lot-submissions')]);
      const current = profileData.profile;
      profile = { ...(profileData.defaults || {}), ...Object.fromEntries(Object.entries(current || {}).filter(([key,value]) => ['displayName','legalName','contactEmail','contactPhone','address'].includes(key) && value)) };
      profileSaved = Boolean(current && ['displayName','legalName','contactEmail','contactPhone','address'].every(key => current[key]));
      if (!profileSaved) profileOpen = true;
      submissions = submissionData.submissions;
      opportunities = submissionData.opportunities;
      categories = submissionData.categories || [...SUBMISSION_CATEGORIES];
      if (!lot.opportunity) lot.opportunity = defaultSubmissionOpportunity(opportunities);
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
      profileSaved = true;
      message = ui("Seller details saved.");
      profileOpen = false;
    } catch (err) {
      problem = err.message;
    } finally {
      busy = false;
    }
  }

  async function createFromImage(file) {
    if (!file || imageBusy) return;
    imageBusy = true;
    clearNotices();
    try {
      const result = await analyzeListingPhoto(file);

      lot.title = result.listing?.title || lot.title;
      lot.description = result.listing?.description || lot.description;
      lot.condition = result.listing?.condition || lot.condition;
      lot.category = result.listing?.category || lot.category;
      lot.images = [...lot.images, result.image].slice(0, 8);
      message = result.analysisError ? ui('Photo attached. {reason}', { reason: ui(result.analysisError) }) : result.warning ? ui(result.warning) : ui("AI created a draft from your photo. Review every field before saving.");
      await tick();
      document.getElementById(result.analysisError ? 'workspace-message' : 'lot-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      problem = err.message;
    } finally {
      imageBusy = false;
    }
  }

  async function attachPhotos(event) {
    if (imageBusy) return;
    imageBusy = true;
    clearNotices();
    try {
      const files = Array.from(event.currentTarget.files || []);
      if (files.length + lot.images.length > 8) throw new Error(ui('A submission may have up to 8 images'));
      const form = new FormData();
      files.forEach(file => form.append('files', file));
      const response = await uploadImageForm(form);
      const result = await response.json();
      lot.images = [...lot.images, ...(result.images || [])];
      if (!response.ok) throw new Error(ui(result.error || result.message || 'Failed to upload images'));
      message = ui('Photos attached. You can enter the details and save your draft.');
    } catch (err) { problem = err.message; }
    finally { imageBusy = false; event.target.value = ''; }
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
    if (busy || imageBusy) return;
    busy = true;
    clearNotices();
    try {
      if (submitAfter) {
        if (!profileReady) {
          profileOpen = true;
          document.getElementById('seller-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          throw new Error(ui('Complete your seller details before submitting.'));
        }
        if (!lot.title.trim()) throw new Error(ui('Add a title before submitting'));
        if (!lot.opportunity) throw new Error(ui('Choose a public auction opportunity.'));
        if (!policy) throw new Error(ui('No active seller policy is currently available.'));
        if (!acceptedTerms) throw new Error(ui('Accept the seller terms before submitting.'));
        await api('/api/seller-profile', { method: 'PUT', body: JSON.stringify(profile) });
        profileSaved = true;
      }
      const saved = await api(editingId ? `/api/lot-submissions/${editingId}` : '/api/lot-submissions', {
        method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(submissionBody())
      });
      // Keep the saved ID even when submitting fails (for example, changed terms).
      editingId = saved.submission.id;
      lot.images = saved.submission.images || lot.images;

      if (submitAfter) {
        await api(`/api/lot-submissions/${saved.submission.id}/submit`, {
          method: 'POST', body: JSON.stringify({ acceptedTerms: true, policyId: policy.id, policyVersion: policy.version })
        });
        message = ui("Lot submitted to Pumbi for review.");
        startNew(false);
      } else {
        message = ui("Draft saved.");
      }
      await refreshSubmissions();
    } catch (err) {
      problem = err.message;
      if (submitAfter && editingId) {
        acceptedTerms = false;
        // Refresh changed terms and submission windows while keeping the saved draft.
        try { await refreshSubmissions(); } catch { /* Keep the original action error. */ }
      }
    } finally {
      busy = false;
      await tick();
      document.getElementById(problem ? 'workspace-problem' : 'workspace-message')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  async function refreshSubmissions() {
    const data = await api('/api/lot-submissions');
    submissions = data.submissions;
    opportunities = data.opportunities;
    categories = data.categories || [...SUBMISSION_CATEGORIES];
    policy = data.policy;
  }

  function editSubmission(item) {
    editingId = item.id;
    acceptedTerms = false;
    lot = {
      title: item.title || '', description: item.description || '', condition: item.condition || '', category: item.category || '',
      requestedStartingBid: item.requestedStartingBid || '', requestedBidIncrement: item.requestedBidIncrement || '',
      opportunity: item.auctionSeriesId ? `series:${item.auctionSeriesId}` : item.auctionId ? `auction:${item.auctionId}` : '',
      images: item.images || []
    };
    customCategory = Boolean(lot.category && !categories.includes(lot.category));
    clearNotices();
    document.getElementById('lot-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  function startNew(clear = true) {
    editingId = null;
    acceptedTerms = false;
    lot = emptyLot();
    lot.opportunity = defaultSubmissionOpportunity(opportunities);
    customCategory = false;
    if (clear) clearNotices();
  }

  function clearNotices() { message = ''; problem = ''; }
  function ratePercent(rate) { return `${(Number(rate) * 100).toLocaleString(uiLocale(), { maximumFractionDigits: 2 })}%`; }
  function formatDate(value) { return value ? new Date(value).toLocaleString(uiLocale()) : ui("Schedule to be announced"); }
</script>

<svelte:head><title>{t("Create a lot | Pumbi")}</title></svelte:head>

<main class="min-h-screen bg-[#f7f4ee] py-8">
  <div class="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><a href="/dashboard" class="text-sm font-semibold text-[#18372f]">{t("← Dashboard")}</a><p class="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#a95739]">{t("Seller workspace")}</p><h1 class="mt-1 text-3xl font-black text-slate-950">{t("Create a lot")}</h1><p class="mt-1 text-sm text-slate-500">{t("Start with a photo or enter the catalog details yourself.")}</p></div>
      <div class="flex flex-wrap gap-2"><a href="/dashboard/sell/bulk" class="inline-flex items-center gap-2 rounded-sm border border-[#ddd6ca] bg-white px-5 py-3 font-bold text-[#18372f] shadow-sm transition hover:bg-[#efe8dc]">{t("Bulk CSV / Grid")}</a><button type="button" onclick={() => document.getElementById('ai-image')?.click()} disabled={busy || imageBusy || lot.images.length >= 8} class="inline-flex items-center gap-2 rounded-sm bg-[#18372f] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#152c26] disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">✦</span>{imageBusy ? ui("Reading image…") : ui("Create listing with AI")}</button></div>
      <button type="button" class="rounded-sm border border-[#ddd6ca] bg-white px-5 py-3 font-bold text-[#18372f] disabled:opacity-50" disabled={busy || imageBusy || lot.images.length >= 8} onclick={() => document.getElementById('lot-photos')?.click()}>{ui('Attach photos')}</button>
      <input id="lot-photos" class="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onchange={attachPhotos} />
      <input id="ai-image" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onchange={(event) => createFromImage(event.currentTarget.files?.[0])} />
    </header>

    {#if problem}<div id="workspace-problem" role="alert" class="rounded-sm border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{ui(problem)}</div>{/if}
    {#if message}<div id="workspace-message" role="status" class="rounded-sm border border-[#c5d0c8] bg-[#e8eee9] p-4 text-sm font-medium text-[#18372f]">{ui(message)}</div>{/if}

    {#if loading}
      <div class="rounded-sm border bg-white py-20 text-center text-slate-500">{t("Loading seller workspace…")}</div>
    {:else}
      <section id="seller-details" class="rounded-sm border bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 p-5">
          <div class="flex items-center gap-3"><span class="grid h-9 w-9 place-items-center rounded-sm {profileReady ? 'bg-emerald-100 text-[#18372f]' : 'bg-amber-100 text-amber-700'}">{profileReady ? '✓' : '!'}</span><div><h2 class="font-bold text-slate-950">{t("Seller details")}</h2><p class="text-sm text-slate-500">{profileReady ? ui("{value0} · ready to submit", { value0: profile.displayName }) : ui('Complete seller details before submitting. Drafts can be saved at any time.')}</p></div></div>
          <button type="button" onclick={() => profileOpen = !profileOpen} class="rounded-lg border px-3 py-2 text-sm font-semibold">{profileOpen ? ui("Close") : profileReady ? ui("Edit details") : ui("Complete details")}</button>
        </div>
        {#if profileOpen}
          <form class="grid gap-4 border-t bg-[#f7f4ee] p-5 sm:grid-cols-2" onsubmit={(event) => { event.preventDefault(); saveProfile(); }}>
            <label class="text-sm font-semibold">{t("Display name")}<input required class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.displayName} /></label>
            <label class="text-sm font-semibold">{t("Legal name")}<input required class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.legalName} /></label>
            <label class="text-sm font-semibold">{t("Contact email")}<input required type="email" class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.contactEmail} /></label>
            <label class="text-sm font-semibold">{t("Contact phone")}<input required class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.contactPhone} /></label>
            <label class="text-sm font-semibold sm:col-span-2">{t("Address")}<textarea required rows="2" class="mt-1 w-full rounded-lg border-slate-300 bg-white font-normal" bind:value={profile.address}></textarea></label>
            <div class="sm:col-span-2"><button disabled={busy} class="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-50">{t("Save details")}</button></div>
          </form>
        {/if}
      </section>

      <section id="lot-form" class="overflow-hidden rounded-sm border bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h2 class="text-xl font-black">{editingId ? ui("Edit lot draft") : ui("New lot draft")}</h2><p class="text-sm text-slate-500">{t("AI suggestions are a starting point—review them for accuracy.")}</p></div>{#if editingId}<button type="button" onclick={() => startNew()} class="text-sm font-bold text-[#18372f]">{t("Start new")}</button>{/if}</div>

        <form class="grid gap-6 p-5 lg:grid-cols-[280px_minmax(0,1fr)]" onsubmit={(event) => { event.preventDefault(); saveLot(event.submitter?.value === 'submit'); }}>
          <div>
            {#if lot.images.length}
              <div class="space-y-3">{#each lot.images as image, index}<div class="overflow-hidden rounded-sm border bg-slate-100"><img src={image.previewUrl || image.url} alt={ui("Listing reference {value0}", { value0: index + 1 })} class="aspect-square w-full object-cover" /></div>{/each}<button type="button" onclick={() => document.getElementById('ai-image')?.click()} disabled={imageBusy || lot.images.length >= 8} class="w-full rounded-lg border border-[#ddd6ca] px-3 py-2 text-sm font-bold text-[#18372f] disabled:opacity-50">{t("+ Analyze another photo")}</button></div>
            {:else}
              <button type="button" onclick={() => document.getElementById('ai-image')?.click()} disabled={busy || imageBusy} class="grid aspect-square w-full place-items-center rounded-sm border-2 border-dashed border-[#ddd6ca] bg-[#efe8dc] p-6 text-center text-[#18372f] disabled:opacity-50"><span><span class="block text-4xl">✦</span><strong class="mt-3 block">{t("Create listing with AI")}</strong><span class="mt-1 block text-sm text-[#a95739]">{t("Take a photo or choose one. AI will draft the listing.")}</span></span></button>
            {/if}
            <p class="mt-3 text-xs leading-5 text-slate-500">{t("JPEG, PNG, or WebP · 12 MB max. Images are stored securely in Pumbi’s S3 bucket.")}</p>
          </div>

          <div class="space-y-4">
            <label class="block text-sm font-semibold">{t("Title")}<input required maxlength="200" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.title} /></label>
            <label class="block text-sm font-semibold">{t("Description")}<textarea rows="5" maxlength="10000" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.description}></textarea></label>
            <label class="block text-sm font-semibold">{t("Condition")}<textarea rows="3" maxlength="2000" placeholder={ui("Visible wear, damage, completeness, repairs, or uncertainty")} class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.condition}></textarea></label>
            <div class="grid gap-4 sm:grid-cols-3">
              <div><label class="block text-sm font-semibold">{t("Category")}<select class="mt-1 w-full rounded-lg border-slate-300 font-normal" value={categoryChoice} onchange={(event) => { customCategory = event.currentTarget.value === '__custom__'; lot.category = customCategory ? '' : event.currentTarget.value; }}><option value="">{ui('Choose a category')}</option>{#each categories as category}<option value={category}>{ui(category)}</option>{/each}<option value="__custom__">{ui('Other category…')}</option></select></label>{#if categoryChoice === '__custom__'}<label class="mt-2 block text-sm font-semibold">{ui('Custom category')}<input maxlength="100" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.category} /></label>{/if}</div>
              <label class="text-sm font-semibold">{t("Starting bid")}<input type="number" min="0" step="0.01" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.requestedStartingBid} /></label>
              <label class="text-sm font-semibold">{t("Bid increment")}<input type="number" min="0" step="0.01" class="mt-1 w-full rounded-lg border-slate-300 font-normal" bind:value={lot.requestedBidIncrement} /></label>
            </div>
            <label class="block text-sm font-semibold">{t("Public auction")}<select required disabled={!hasOpportunities} class="mt-1 w-full rounded-lg border-slate-300 font-normal disabled:bg-slate-100" bind:value={lot.opportunity}><option value="">{hasOpportunities ? t('Choose a series or auction') : ui('No public auctions are accepting submissions right now')}</option>{#if lot.opportunity && ![...opportunities.series.map(item => `series:${item.id}`), ...opportunities.auctions.map(item => `auction:${item.id}`)].includes(lot.opportunity)}<option value={lot.opportunity}>{ui('Previous selection — choose an available auction before submitting')}</option>{/if}{#each opportunities.series as series}<option value={`series:${series.id}`}>{series.name} {t("— monthly, next")} {formatDate(series.nextRunAt)}</option>{/each}{#each opportunities.auctions as auction}<option value={`auction:${auction.id}`}>{auction.title} — {formatDate(auction.startDate)}</option>{/each}</select></label>
            <p class="text-sm text-slate-500">{hasOpportunities ? ui('Choose where to submit your lot for review. You can choose later when saving a draft.') : ui('No submission window is open. Save your draft now and return when a public auction opens.')}</p>

            {#if policy}
              <div class="rounded-sm border border-[#ddd6ca] bg-[#efe8dc] p-4"><details><summary class="cursor-pointer font-bold text-blue-950">{t("Pumbi seller terms ·")} {ratePercent(policy.sellerCommissionRate)} {t("commission")}</summary><div class="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-700">{policy.sellerTerms}</div></details><label class="mt-3 flex items-start gap-2 text-sm font-semibold text-blue-950"><input type="checkbox" class="mt-1 rounded" bind:checked={acceptedTerms} /><span>{t("I accept version")} {policy.version} {t("of the Pumbi seller terms and rates.")}</span></label></div>
            {:else}<div class="rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t("No active seller policy is published. You can save drafts, but submitting is temporarily unavailable.")}</div>{/if}

            <div class="flex flex-wrap gap-3"><button type="submit" name="intent" value="draft" formnovalidate disabled={busy || imageBusy} class="rounded-lg border px-4 py-2 font-bold disabled:opacity-50">{t("Save draft")}</button><button type="submit" name="intent" value="submit" disabled={busy || imageBusy || !policy || !hasOpportunities} class="rounded-lg bg-[#18372f] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{t("Submit for review")}</button></div>
          </div>
        </form>
      </section>

      <section class="rounded-sm border bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><div><h2 class="text-xl font-black">{t("Your submissions")}</h2><p class="text-sm text-slate-500">{t("Drafts and review progress")}</p></div><span class="rounded-sm bg-slate-100 px-3 py-1 text-xs font-bold">{submissions.length}</span></div>{#if submissions.length === 0}<div class="py-10 text-center text-sm text-slate-500">{t("You have not created any lot submissions yet.")}</div>{:else}<div class="mt-5 grid gap-3 md:grid-cols-2">{#each submissions as item}<article class="flex gap-4 rounded-sm border p-4">{#if item.images?.[0]}<img src={item.images[0].previewUrl} alt={item.title || ui("Lot submission")} class="h-20 w-20 shrink-0 rounded-lg object-cover" />{:else}<div class="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-slate-100 text-2xl text-slate-300">◇</div>{/if}<div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><h3 class="truncate font-bold">{item.title || ui("Untitled draft")}</h3><span class={`rounded-sm px-2 py-0.5 text-[10px] font-bold ${item.status === 'APPROVED' ? 'bg-emerald-100 text-[#18372f]' : item.status === 'REJECTED' ? 'bg-red-100 text-red-800' : item.status === 'SUBMITTED' ? 'bg-blue-100 text-[#18372f]' : 'bg-slate-100 text-slate-700'}`}>{uiStatus(item.status)}</span></div><p class="mt-1 truncate text-xs text-slate-500">{item.auctionSeries?.name || item.auction?.title || (item.auctionSeriesId || item.auctionId ? ui('Opportunity unavailable') : ui('No auction selected yet'))}</p>{#if item.rejectionReason}<p class="mt-2 text-xs text-red-700">{item.rejectionReason}</p>{/if}<div class="mt-3 flex gap-3 text-xs"><span class="text-slate-400">{t("Updated")} {formatDate(item.updatedAt)}</span>{#if item.status === 'DRAFT' || item.status === 'REJECTED'}<button type="button" class="font-bold text-[#18372f]" onclick={() => editSubmission(item)}>{t("Edit")}</button>{/if}</div></div></article>{/each}</div>{/if}</section>
    {/if}
  </div>
</main>
