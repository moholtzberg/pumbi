<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  const steps = ['Company', 'Locations', 'Compliance', 'Brand assets', 'Banking', 'Team', 'Terms', 'Review'];
  const businessTypes = ['SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLC', 'CORPORATION', 'NONPROFIT', 'OTHER'];
  const locationTypes = ['HEADQUARTERS', 'OFFICE', 'WAREHOUSE', 'SHOWROOM', 'OTHER'];
  const documentTypes = ['BUSINESS_LICENSE', 'TAX_DOCUMENT', 'BANK_VERIFICATION', 'INSURANCE', 'INCORPORATION', 'IDENTITY', 'OTHER'];
  const assetTypes = ['LOGO', 'BANNER', 'BRAND_GUIDE'];

  let loading = $state(true);
  let saving = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  let auctionHouseId = $state('');
  let currentStep = $state(0);
  let onboarding = $state({});
  let locations = $state([]);
  let documents = $state([]);
  let assets = $state([]);
  let stripe = $state({});
  let policy = $state(null);
  let termsAccepted = $state(false);
  let showLocationForm = $state(false);
  let editingLocationId = $state('');
  let documentFile = $state(null);
  let assetFile = $state(null);

  let company = $state({
    legalName: '', businessType: '', registrationNumber: '', website: '',
    contactFirstName: '', contactLastName: '', contactEmail: '', contactPhone: '', country: ''
  });
  let locationForm = $state(newLocation());
  let documentForm = $state({ type: 'BUSINESS_LICENSE', licenseNumber: '', jurisdiction: '', expiresAt: '' });
  let assetForm = $state({ type: 'LOGO', visibility: 'PUBLIC' });

  const status = $derived(onboarding.onboardingStatus || onboarding.status || 'DRAFT');
  const isLocked = $derived(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(status));

  function newLocation() {
    return {
      name: '', type: 'HEADQUARTERS', isPrimary: false, addressLine1: '', addressLine2: '',
      city: '', stateProvince: '', postalCode: '', country: '', contactName: '', contactEmail: '', contactPhone: ''
    };
  }

  function apiMessage(data, fallback) {
    return data?.message || data?.error || data?.details || fallback;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiMessage(data, `Request failed (${response.status})`));
    return data;
  }

  function collection(data, key) {
    if (Array.isArray(data)) return data;
    return data?.[key] || [];
  }

  function populateCompany(source) {
    const house = source.auctionHouse || source.onboarding || source;
    if (source.policy !== undefined) policy = source.policy;
    onboarding = { ...onboarding, ...house };
    for (const key of Object.keys(company)) {
      if (house[key] !== undefined && house[key] !== null) company[key] = house[key];
    }
    termsAccepted = Boolean(house.termsAcceptedAt || source.termsAccepted);
    if (Number.isInteger(house.onboardingStep)) currentStep = Math.min(house.onboardingStep, steps.length - 1);
  }

  async function load() {
    try {
      loading = true;
      errorMessage = '';
      const session = await request('/auth/session');
      if (!session?.user?.email) {
        goto(`/auth/login?redirect=${encodeURIComponent('/seller/onboarding')}`);
        return;
      }
      const user = await request(`/api/users?email=${encodeURIComponent(session.user.email)}`);
      auctionHouseId = user.auctionHouseId || user.auctionHouse?.id || '';
      if (!auctionHouseId) {
        goto('/auction-houses/signup');
        return;
      }
      const base = `/api/auction-houses/${auctionHouseId}`;
      const results = await Promise.allSettled([
        request(`${base}/onboarding`),
        request(`${base}/onboarding/locations`),
        request(`${base}/onboarding/documents`),
        request(`${base}/onboarding/assets`),
        request(`${base}/connect`)
      ]);
      if (results[0].status === 'fulfilled') populateCompany(results[0].value);
      else throw results[0].reason;
      if (results[1].status === 'fulfilled') locations = collection(results[1].value, 'locations');
      if (results[2].status === 'fulfilled') documents = collection(results[2].value, 'documents');
      if (results[3].status === 'fulfilled') assets = collection(results[3].value, 'assets');
      if (results[4].status === 'fulfilled') stripe = results[4].value.stripe || results[4].value;
    } catch (error) {
      errorMessage = error.message || 'Unable to load onboarding. Please refresh and try again.';
    } finally {
      loading = false;
    }
  }

  async function saveCompany(next = false) {
    if (!company.legalName.trim() || !company.businessType || !company.registrationNumber.trim() ||
      !company.contactFirstName.trim() || !company.contactLastName.trim() ||
      !company.contactEmail.trim() || !company.contactPhone.trim() || !/^[A-Za-z]{2}$/.test(company.country.trim())) {
      errorMessage = 'Complete all required company and contact fields.';
      return;
    }
    await performSave(async () => {
      const data = await request(`/api/auction-houses/${auctionHouseId}/onboarding`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...company, country: company.country.trim().toUpperCase() })
      });
      populateCompany(data);
      if (next) currentStep = 1;
    }, 'Company information saved.');
  }

  async function performSave(action, message) {
    try {
      saving = true;
      errorMessage = '';
      successMessage = '';
      await action();
      successMessage = message;
    } catch (error) {
      errorMessage = error.message || 'Something went wrong. Please try again.';
    } finally {
      saving = false;
    }
  }

  function editLocation(location) {
    editingLocationId = location.id;
    locationForm = { ...newLocation(), ...location };
    showLocationForm = true;
  }

  async function saveLocation() {
    if (!locationForm.addressLine1 || !locationForm.city || !locationForm.country) {
      errorMessage = 'Address, city, and country are required.';
      return;
    }
    await performSave(async () => {
      const url = editingLocationId
        ? `/api/auction-houses/${auctionHouseId}/onboarding/locations/${editingLocationId}`
        : `/api/auction-houses/${auctionHouseId}/onboarding/locations`;
      await request(url, {
        method: editingLocationId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm)
      });
      locations = collection(await request(`/api/auction-houses/${auctionHouseId}/onboarding/locations`), 'locations');
      locationForm = newLocation();
      editingLocationId = '';
      showLocationForm = false;
    }, 'Location saved.');
  }

  async function deleteLocation(id) {
    if (!confirm('Delete this location?')) return;
    await performSave(async () => {
      await request(`/api/auction-houses/${auctionHouseId}/onboarding/locations/${id}`, { method: 'DELETE' });
      locations = locations.filter((item) => item.id !== id);
    }, 'Location deleted.');
  }

  async function uploadDocument() {
    if (!documentFile) {
      errorMessage = 'Choose a document to upload.';
      return;
    }
    await performSave(async () => {
      const body = new FormData();
      body.append('file', documentFile);
      Object.entries(documentForm).forEach(([key, value]) => value && body.append(key, value));
      await request(`/api/auction-houses/${auctionHouseId}/onboarding/documents`, { method: 'POST', body });
      documents = collection(await request(`/api/auction-houses/${auctionHouseId}/onboarding/documents`), 'documents');
      documentFile = null;
      documentForm = { type: 'BUSINESS_LICENSE', licenseNumber: '', jurisdiction: '', expiresAt: '' };
    }, 'Compliance document uploaded.');
  }

  async function deleteDocument(id) {
    if (!confirm('Delete this document?')) return;
    await performSave(async () => {
      await request(`/api/auction-houses/${auctionHouseId}/onboarding/documents/${id}`, { method: 'DELETE' });
      documents = documents.filter((item) => item.id !== id);
    }, 'Document deleted.');
  }

  async function uploadAsset() {
    if (!assetFile) {
      errorMessage = 'Choose a brand asset to upload.';
      return;
    }
    await performSave(async () => {
      const body = new FormData();
      body.append('file', assetFile);
      body.append('type', assetForm.type);
      body.append('visibility', assetForm.visibility);
      await request(`/api/auction-houses/${auctionHouseId}/onboarding/assets`, { method: 'POST', body });
      assets = collection(await request(`/api/auction-houses/${auctionHouseId}/onboarding/assets`), 'assets');
      assetFile = null;
    }, 'Brand asset uploaded.');
  }

  async function deleteAsset(id) {
    if (!confirm('Delete this asset?')) return;
    await performSave(async () => {
      await request(`/api/auction-houses/${auctionHouseId}/onboarding/assets/${id}`, { method: 'DELETE' });
      assets = assets.filter((item) => item.id !== id);
    }, 'Asset deleted.');
  }

  async function openStripe() {
    await performSave(async () => {
      const data = await request(`/api/auction-houses/${auctionHouseId}/connect`, { method: 'POST' });
      const url = data.onboardingUrl || data.url || data.link || data.accountLink?.url;
      if (!url) throw new Error('Stripe did not return an onboarding link.');
      location.assign(url);
    }, 'Opening secure Stripe onboarding…');
  }

  async function acceptTerms() {
    if (!termsAccepted) {
      errorMessage = 'You must explicitly accept the auction house terms.';
      return;
    }
    currentStep = 7;
    successMessage = 'Terms selected. Submit the package to record your acceptance.';
  }

  async function submitOnboarding() {
    if (!termsAccepted) {
      errorMessage = 'Accept the terms before submitting.';
      currentStep = 6;
      return;
    }
    await performSave(async () => {
      if (!policy) throw new Error('No active auction-house terms are available.');
      const data = await request(`/api/auction-houses/${auctionHouseId}/onboarding/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptedTerms: true,
          policyId: policy.id,
          policyVersion: policy.version
        })
      });
      populateCompany(data);
    }, 'Onboarding submitted for review. Seller access remains limited until approval.');
  }

  function label(value) {
    return String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function statusClass(value) {
    if (value === 'APPROVED' || value === 'ENABLED') return 'bg-green-100 text-green-800';
    if (value === 'REJECTED' || value === 'RESTRICTED') return 'bg-red-100 text-red-800';
    if (value === 'SUBMITTED' || value === 'UNDER_REVIEW' || value === 'PENDING') return 'bg-amber-100 text-amber-800';
    return 'bg-gray-100 text-gray-700';
  }

  onMount(() => {
    const requestedStep = Number(new URLSearchParams(location.search).get('step'));
    if (Number.isInteger(requestedStep) && requestedStep >= 0 && requestedStep < steps.length) currentStep = requestedStep;
    load();
  });
</script>

<svelte:head><title>Seller onboarding | Pumbi</title></svelte:head>

<div class="min-h-screen bg-slate-50">
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-blue-700">Seller verification</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-950">Auction house onboarding</h1>
        <p class="mt-2 max-w-3xl text-slate-600">Complete your business profile for review. Auction publishing, payouts, and other seller tools remain limited until approval.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <span class="rounded-full px-3 py-1 text-sm font-semibold {statusClass(status)}">{label(status)}</span>
        <a href="/seller" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Seller dashboard</a>
      </div>
    </div>

    {#if status === 'REJECTED'}
      <div class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
        <p class="font-semibold">Changes requested</p>
        <p class="mt-1 text-sm">{onboarding.onboardingRejectionReason || onboarding.rejectionReason || 'Please review your information and resubmit.'}</p>
      </div>
    {:else if status === 'APPROVED'}
      <div class="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
        <p class="font-semibold">Your auction house is approved.</p>
        <p class="mt-1 text-sm">You can now use the full seller dashboard.</p>
      </div>
    {:else if isLocked}
      <div class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <p class="font-semibold">Your application is being reviewed.</p>
        <p class="mt-1 text-sm">Access remains limited until approval. You can review the submitted information below.</p>
      </div>
    {/if}

    {#if errorMessage}<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{errorMessage}</div>{/if}
    {#if successMessage}<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">{successMessage}</div>{/if}

    {#if loading}
      <div class="rounded-xl bg-white p-12 text-center shadow-sm"><div class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"></div><p class="mt-4 text-slate-600">Loading onboarding…</p></div>
    {:else}
      <div class="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav class="rounded-xl bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:self-start" aria-label="Onboarding steps">
          <div class="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {#each steps as step, index}
              <button type="button" onclick={() => currentStep = index} class="flex min-w-max items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium lg:w-full {currentStep === index ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50'}">
                <span class="grid h-7 w-7 place-items-center rounded-full {currentStep === index ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}">{index + 1}</span>{step}
              </button>
            {/each}
          </div>
        </nav>

        <main class="rounded-xl bg-white p-5 shadow-sm sm:p-8">
          {#if currentStep === 0}
            <h2 class="text-2xl font-bold text-slate-900">Company information</h2>
            <p class="mt-1 text-sm text-slate-600">Use the legal details that match your registration records.</p>
            <form class="mt-6 grid gap-5 sm:grid-cols-2" onsubmit={(event) => { event.preventDefault(); saveCompany(true); }}>
              <label class="sm:col-span-2"><span>Legal company name *</span><input bind:value={company.legalName} required disabled={isLocked} /></label>
              <label><span>Business type *</span><select bind:value={company.businessType} required disabled={isLocked}><option value="">Select type</option>{#each businessTypes as type}<option value={type}>{label(type)}</option>{/each}</select></label>
              <label><span>Registration number *</span><input bind:value={company.registrationNumber} required disabled={isLocked} autocomplete="off" /></label>
              <label class="sm:col-span-2"><span>Website</span><input type="url" bind:value={company.website} disabled={isLocked} placeholder="https://example.com" /></label>
              <label><span>Contact first name *</span><input bind:value={company.contactFirstName} required disabled={isLocked} autocomplete="given-name" /></label>
              <label><span>Contact last name *</span><input bind:value={company.contactLastName} required disabled={isLocked} autocomplete="family-name" /></label>
              <label><span>Contact email *</span><input type="email" bind:value={company.contactEmail} required disabled={isLocked} autocomplete="email" /></label>
              <label><span>Contact phone *</span><input type="tel" bind:value={company.contactPhone} required disabled={isLocked} autocomplete="tel" /></label>
              <label><span>Country code *</span><input bind:value={company.country} maxlength="2" placeholder="US" required disabled={isLocked} autocomplete="country" /></label>
              <div class="rounded-lg bg-blue-50 p-4 text-sm text-blue-900"><strong>Tax ID:</strong> collected securely by Stripe. Pumbi never asks you to enter a raw tax ID here.{#if onboarding.taxIdLast4} Saved ID ending in •••• {onboarding.taxIdLast4}.{/if}</div>
              <div class="sm:col-span-2 flex justify-end"><button class="primary" type="submit" disabled={saving || isLocked}>{saving ? 'Saving…' : 'Save and continue'}</button></div>
            </form>
          {:else if currentStep === 1}
            <div class="flex items-center justify-between gap-4"><div><h2 class="text-2xl font-bold">Locations</h2><p class="mt-1 text-sm text-slate-600">Add every office, showroom, or warehouse and select one primary location.</p></div><button class="primary" type="button" disabled={isLocked} onclick={() => { locationForm = newLocation(); editingLocationId = ''; showLocationForm = true; }}>Add location</button></div>
            <div class="mt-6 space-y-3">
              {#each locations as item}
                <div class="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"><div><p class="font-semibold">{item.name || label(item.type)} {#if item.isPrimary}<span class="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">Primary</span>{/if}</p><p class="mt-1 text-sm text-slate-600">{item.addressLine1}, {item.city}{item.stateProvince ? `, ${item.stateProvince}` : ''} {item.postalCode || ''}, {item.country}</p></div><div class="flex gap-2"><button class="secondary" type="button" disabled={isLocked} onclick={() => editLocation(item)}>Edit</button><button class="danger" type="button" disabled={isLocked} onclick={() => deleteLocation(item.id)}>Delete</button></div></div>
              {:else}<p class="rounded-lg border border-dashed p-8 text-center text-slate-500">No locations added yet.</p>{/each}
            </div>
            {#if showLocationForm}
              <form class="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2" onsubmit={(event) => { event.preventDefault(); saveLocation(); }}>
                <label><span>Location name</span><input bind:value={locationForm.name} placeholder="Main office" /></label>
                <label><span>Type</span><select bind:value={locationForm.type}>{#each locationTypes as type}<option value={type}>{label(type)}</option>{/each}</select></label>
                <label class="sm:col-span-2"><span>Address line 1 *</span><input bind:value={locationForm.addressLine1} required autocomplete="address-line1" /></label>
                <label class="sm:col-span-2"><span>Address line 2</span><input bind:value={locationForm.addressLine2} autocomplete="address-line2" /></label>
                <label><span>City *</span><input bind:value={locationForm.city} required autocomplete="address-level2" /></label><label><span>State / province</span><input bind:value={locationForm.stateProvince} autocomplete="address-level1" /></label>
                <label><span>Postal code</span><input bind:value={locationForm.postalCode} autocomplete="postal-code" /></label><label><span>Country *</span><input bind:value={locationForm.country} required autocomplete="country-name" /></label>
                <label><span>Contact name</span><input bind:value={locationForm.contactName} /></label><label><span>Contact email</span><input type="email" bind:value={locationForm.contactEmail} /></label>
                <label><span>Contact phone</span><input type="tel" bind:value={locationForm.contactPhone} /></label><label class="flex items-center gap-2 self-end pb-3"><input class="h-4 w-4" type="checkbox" bind:checked={locationForm.isPrimary} /><span class="mb-0">Primary location</span></label>
                <div class="flex justify-end gap-2 sm:col-span-2"><button class="secondary" type="button" onclick={() => showLocationForm = false}>Cancel</button><button class="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save location'}</button></div>
              </form>
            {/if}
          {:else if currentStep === 2}
            <h2 class="text-2xl font-bold">Compliance documents</h2><p class="mt-1 text-sm text-slate-600">Upload current business records. Documents are private and reviewed by Pumbi.</p>
            <form class="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2" onsubmit={(event) => { event.preventDefault(); uploadDocument(); }}>
              <label><span>Document type *</span><select bind:value={documentForm.type} disabled={isLocked}>{#each documentTypes as type}<option value={type}>{label(type)}</option>{/each}</select></label>
              <label><span>File *</span><input type="file" required disabled={isLocked} accept=".pdf,.png,.jpg,.jpeg" onchange={(event) => documentFile = event.currentTarget.files?.[0] || null} /></label>
              <label><span>License number</span><input bind:value={documentForm.licenseNumber} disabled={isLocked} /></label><label><span>Jurisdiction</span><input bind:value={documentForm.jurisdiction} disabled={isLocked} /></label>
              <label><span>Expiration date</span><input type="date" bind:value={documentForm.expiresAt} disabled={isLocked} /></label>
              <div class="flex items-end justify-end"><button class="primary" type="submit" disabled={saving || isLocked}>Upload document</button></div>
            </form>
            <div class="mt-5 space-y-3">{#each documents as item}<div class="flex items-center justify-between rounded-lg border p-4"><div><p class="font-semibold">{item.fileName || label(item.type)}</p><p class="text-sm text-slate-500">{label(item.type)} · <span class="rounded-full px-2 py-0.5 {statusClass(item.reviewStatus)}">{label(item.reviewStatus || 'PENDING')}</span>{item.licenseNumber ? ` · License ${item.licenseNumber}` : ''}</p></div><button class="danger" type="button" disabled={isLocked} onclick={() => deleteDocument(item.id)}>Delete</button></div>{:else}<p class="rounded-lg border border-dashed p-8 text-center text-slate-500">No compliance documents uploaded.</p>{/each}</div>
          {:else if currentStep === 3}
            <h2 class="text-2xl font-bold">Brand assets</h2><p class="mt-1 text-sm text-slate-600">Add your logo, banners, and optional brand guide.</p>
            <form class="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-3" onsubmit={(event) => { event.preventDefault(); uploadAsset(); }}>
              <label><span>Asset type</span><select bind:value={assetForm.type} disabled={isLocked}>{#each assetTypes as type}<option value={type}>{label(type)}</option>{/each}</select></label>
              <label><span>Visibility</span><select bind:value={assetForm.visibility} disabled={isLocked}><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select></label>
              <label><span>File *</span><input type="file" required disabled={isLocked} accept="image/*,.pdf" onchange={(event) => assetFile = event.currentTarget.files?.[0] || null} /></label>
              <div class="sm:col-span-3 flex justify-end"><button class="primary" type="submit" disabled={saving || isLocked}>Upload asset</button></div>
            </form>
            <div class="mt-5 grid gap-3 sm:grid-cols-2">{#each assets as item}<div class="flex items-center justify-between rounded-lg border p-4"><div><p class="font-semibold">{item.fileName || label(item.type)}</p><p class="text-sm text-slate-500">{label(item.type)} · {label(item.visibility)}</p></div><button class="danger" type="button" disabled={isLocked} onclick={() => deleteAsset(item.id)}>Delete</button></div>{:else}<p class="rounded-lg border border-dashed p-8 text-center text-slate-500 sm:col-span-2">No brand assets uploaded.</p>{/each}</div>
          {:else if currentStep === 4}
            <h2 class="text-2xl font-bold">Banking and payouts</h2>
            <div class="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5"><div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p class="font-semibold text-blue-950">Stripe Connect</p><p class="mt-1 text-sm text-blue-800">Enter bank account, routing, and Tax ID details only on Stripe’s secure site. Pumbi never collects these raw values.</p></div><span class="self-start rounded-full px-3 py-1 text-sm font-semibold {statusClass(stripe.status || onboarding.stripeConnectStatus)}">{label(stripe.status || onboarding.stripeConnectStatus || 'NOT_CONNECTED')}</span></div><div class="mt-4 grid gap-2 text-sm sm:grid-cols-3"><p>Details submitted: <strong>{stripe.detailsSubmitted ? 'Yes' : 'No'}</strong></p><p>Charges enabled: <strong>{stripe.chargesEnabled ? 'Yes' : 'No'}</strong></p><p>Payouts enabled: <strong>{stripe.payoutsEnabled ? 'Yes' : 'No'}</strong></p></div><button class="primary mt-5" type="button" onclick={openStripe} disabled={saving}>{stripe.status === 'ENABLED' ? 'Open Stripe account' : 'Connect with Stripe'}</button></div>
            <div class="mt-6 rounded-xl border p-5"><h3 class="font-semibold">Bank verification document</h3><p class="mt-1 text-sm text-slate-600">If requested, upload a voided check or bank letter under Compliance as “Bank verification.” Do not type account or routing numbers into Pumbi.</p><button class="secondary mt-4" type="button" onclick={() => currentStep = 2}>Go to documents</button></div>
          {:else if currentStep === 5}
            <h2 class="text-2xl font-bold">Team</h2><p class="mt-2 text-slate-600">Invite colleagues and assign only the access they need. Team management opens in a dedicated page.</p><a href="/seller/team" class="primary mt-6 inline-flex">Manage team and invitations</a>
          {:else if currentStep === 6}
            <h2 class="text-2xl font-bold">Auction house terms</h2>
            <div class="mt-5 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border bg-slate-50 p-5 text-sm leading-6 text-slate-700">{policy?.auctionHouseTerms || onboarding.termsSnapshot || 'The current auction house terms could not be loaded. Please retry before accepting.'}</div>
            <label class="mt-5 flex items-start gap-3 rounded-lg border p-4"><input class="mt-1 h-4 w-4" type="checkbox" bind:checked={termsAccepted} disabled={isLocked || !policy?.auctionHouseTerms} /><span>I have read and agree to auction house terms version {policy?.version || onboarding.termsVersion || '—'} on behalf of the company. I understand this acceptance is recorded when I submit.</span></label>
            <div class="mt-5 flex justify-end"><button class="primary" type="button" onclick={acceptTerms} disabled={saving || isLocked || !termsAccepted}>Accept and continue</button></div>
          {:else}
            <h2 class="text-2xl font-bold">Review and submit</h2><p class="mt-1 text-sm text-slate-600">Confirm your onboarding package before sending it to Pumbi.</p>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <div class="review"><span>Company</span><strong>{company.legalName || 'Incomplete'}</strong><button type="button" onclick={() => currentStep = 0}>Review</button></div>
              <div class="review"><span>Locations</span><strong>{locations.length} added</strong><button type="button" onclick={() => currentStep = 1}>Review</button></div>
              <div class="review"><span>Compliance</span><strong>{documents.length} uploaded</strong><button type="button" onclick={() => currentStep = 2}>Review</button></div>
              <div class="review"><span>Brand assets</span><strong>{assets.length} uploaded</strong><button type="button" onclick={() => currentStep = 3}>Review</button></div>
              <div class="review"><span>Stripe Connect</span><strong>{label(stripe.status || onboarding.stripeConnectStatus || 'NOT_CONNECTED')}</strong><button type="button" onclick={() => currentStep = 4}>Review</button></div>
              <div class="review"><span>Terms</span><strong>{termsAccepted ? 'Accepted' : 'Not accepted'}</strong><button type="button" onclick={() => currentStep = 6}>Review</button></div>
            </div>
            <div class="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Submitting does not grant immediate seller access. Auction publishing, payouts, and other restricted features remain unavailable while Pumbi reviews your application.</div>
            <div class="mt-6 flex justify-end"><button class="primary" type="button" onclick={submitOnboarding} disabled={saving || isLocked || !termsAccepted}>{saving ? 'Submitting…' : 'Submit for review'}</button></div>
          {/if}

          {#if currentStep > 0 && currentStep < 7}
            <div class="mt-8 flex justify-between border-t pt-5"><button class="secondary" type="button" onclick={() => currentStep--}>Back</button><button class="secondary" type="button" onclick={() => currentStep++}>Continue</button></div>
          {/if}
        </main>
      </div>
    {/if}
  </div>
</div>

<style>
  label span { margin-bottom: .4rem; display: block; font-size: .875rem; font-weight: 600; color: rgb(51 65 85); }
  label input:not([type='checkbox']), label select { width: 100%; border-radius: .5rem; border: 1px solid rgb(203 213 225); padding: .65rem .75rem; background: white; color: rgb(15 23 42); }
  label input:focus, label select:focus { outline: 2px solid rgb(59 130 246 / .35); border-color: rgb(37 99 235); }
  label input:disabled, label select:disabled { background: rgb(241 245 249); color: rgb(100 116 139); }
  button.primary, a.primary { border-radius: .5rem; background: rgb(37 99 235); padding: .65rem 1rem; color: white; font-weight: 700; }
  button.primary:hover, a.primary:hover { background: rgb(29 78 216); }
  button.primary:disabled, button.secondary:disabled, button.danger:disabled { cursor: not-allowed; opacity: .5; }
  button.secondary { border-radius: .5rem; border: 1px solid rgb(203 213 225); background: white; padding: .55rem .9rem; color: rgb(51 65 85); font-weight: 600; }
  button.danger { border-radius: .5rem; padding: .55rem .8rem; color: rgb(185 28 28); font-weight: 600; }
  .review { display: grid; grid-template-columns: 1fr auto; gap: .25rem 1rem; border: 1px solid rgb(226 232 240); border-radius: .75rem; padding: 1rem; }
  .review span { font-size: .8rem; color: rgb(100 116 139); }
  .review strong { grid-column: 1; }
  .review button { grid-column: 2; grid-row: 1 / span 2; align-self: center; color: rgb(37 99 235); font-size: .875rem; font-weight: 700; }
</style>
