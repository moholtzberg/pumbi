<script>
  import RegionalPayoutOptions from '$lib/components/RegionalPayoutOptions.svelte';
  import { translate } from '$lib/i18n.js';
  import { page } from '$app/stores';
  const t = (text, values) => translate($page.data.locale || 'en', text, values);

  import { invalidateAll } from '$app/navigation';

  let { data } = $props();
  let verification = $state(data.verification);
  let busy = $state('');
  let errorMessage = $state('');
  let successMessage = $state(data.notice || '');
  let emailCode = $state('');
  let phoneCode = $state('');
  let emailCodeSent = $state(false);
  let phoneCodeSent = $state(false);
  let sellerCountry = $state(data.verification.seller?.country || data.verification.user.country || 'US');
  let sellerBusinessType = $state(data.verification.seller?.businessType || 'INDIVIDUAL');

  async function action(name, payload = {}) {
    busy = name;
    errorMessage = '';
    successMessage = '';
    try {
      const response = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: name, ...payload })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.error || 'Verification request failed');
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      if (result.checks) verification = result;
      if (name === 'send_email') { emailCodeSent = true; successMessage = t('Code sent to {target}.', { target: verification.user.email }); }
      if (name === 'send_phone') { phoneCodeSent = true; successMessage = t('Code sent to {target}.', { target: verification.user.phone }); }
      if (name === 'check_email' || name === 'check_phone') {
        successMessage = t('Verification completed.');
        await invalidateAll();
      }
    } catch (error) {
      errorMessage = error.message;
    } finally {
      busy = '';
    }
  }

  const label = (value) => t((value || 'NOT_STARTED').replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()));
</script>

<svelte:head><title>{t("Account verification | Pumbi")}</title></svelte:head>

<main class="min-h-screen bg-[#f7f4ee]">
  <div class="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div><p class="text-sm font-bold uppercase tracking-[0.18em] text-[#a95739]">{t("Trust & safety")}</p><h1 class="mt-1 text-3xl font-black text-slate-950">{t("Account verification")}</h1><p class="mt-2 max-w-2xl text-slate-600">{t("Complete each secure check to buy and bid. Sensitive identity, card, bank, and tax details are collected by Stripe, not stored by Pumbi.")}</p></div>
      <div class="rounded-sm bg-[#152c26] px-5 py-4 text-white"><p class="text-xs font-bold uppercase tracking-wider text-[#d6b477]">{t("Buyer progress")}</p><p class="mt-1 text-2xl font-black">{verification.completedCount} {t("of 4")}</p></div>
    </header>

    {#if successMessage}<div class="rounded-sm border border-[#c5d0c8] bg-[#e8eee9] p-4 text-sm font-semibold text-emerald-900">{successMessage}</div>{/if}
    {#if errorMessage}<div class="rounded-sm border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{errorMessage}</div>{/if}

    {#if verification.user.isVerifiedBuyer}
      <section class="rounded-sm border border-[#c5d0c8] bg-[#e8eee9] p-6"><div class="flex gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-emerald-600 text-xl text-white">✓</span><div><h2 class="text-xl font-black text-emerald-950">{t("Buyer verification complete")}</h2><p class="mt-1 text-sm text-[#18372f]">{t("Your verified status is active. Bidder access may still require auction approval.")}</p></div></div></section>
    {/if}

    <section class="grid gap-4 md:grid-cols-2">
      <article class="rounded-sm border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Step 1")}</p><h2 class="mt-1 text-lg font-black">{t("Verify email")}</h2></div><span class="rounded-sm px-3 py-1 text-xs font-bold {verification.checks.email ? 'bg-emerald-100 text-[#18372f]' : 'bg-amber-100 text-amber-800'}">{t(verification.checks.email ? 'Verified' : 'Required')}</span></div>
        <p class="mt-3 text-sm text-slate-600">{t("Confirm access to")} <strong>{verification.user.email}</strong>.</p>
        {#if !verification.checks.email}
          {#if emailCodeSent}<div class="mt-4 flex gap-2"><input aria-label={t('Email verification code')} inputmode="numeric" autocomplete="one-time-code" placeholder={t('Verification code')} bind:value={emailCode} class="min-w-0 flex-1 rounded-lg border-slate-300" /><button onclick={() => action('check_email', { code: emailCode })} disabled={busy || !emailCode} class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{t("Confirm")}</button></div>{/if}
          <button onclick={() => action('send_email')} disabled={busy} class="mt-4 text-sm font-bold text-[#18372f] disabled:opacity-50">{t(emailCodeSent ? 'Send a new code' : 'Send email code')} →</button>
        {/if}
      </article>

      <article class="rounded-sm border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Step 2")}</p><h2 class="mt-1 text-lg font-black">{t("Verify phone")}</h2></div><span class="rounded-sm px-3 py-1 text-xs font-bold {verification.checks.phone ? 'bg-emerald-100 text-[#18372f]' : 'bg-amber-100 text-amber-800'}">{t(verification.checks.phone ? 'Verified' : 'Required')}</span></div>
        <p class="mt-3 text-sm text-slate-600">{verification.user.phone ? `Confirm ${verification.user.phone} by SMS.` : 'Add a mobile phone number with its country code.'}</p>
        {#if !verification.user.phone}<a href="/dashboard/profile" class="mt-4 inline-flex text-sm font-bold text-[#18372f]">{t("Add phone number →")}</a>{:else if !verification.checks.phone}
          {#if phoneCodeSent}<div class="mt-4 flex gap-2"><input aria-label={t('Phone verification code')} inputmode="numeric" autocomplete="one-time-code" placeholder={t('Verification code')} bind:value={phoneCode} class="min-w-0 flex-1 rounded-lg border-slate-300" /><button onclick={() => action('check_phone', { code: phoneCode })} disabled={busy || !phoneCode} class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{t("Confirm")}</button></div>{/if}
          <button onclick={() => action('send_phone')} disabled={busy} class="mt-4 text-sm font-bold text-[#18372f] disabled:opacity-50">{t(phoneCodeSent ? 'Send a new code' : 'Send SMS code')} →</button>
        {/if}
      </article>

      <article class="rounded-sm border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Step 3")}</p><h2 class="mt-1 text-lg font-black">{t("Photo ID + selfie")}</h2></div><span class="rounded-sm px-3 py-1 text-xs font-bold {verification.checks.identity ? 'bg-emerald-100 text-[#18372f]' : 'bg-amber-100 text-amber-800'}">{label(verification.identity.status)}</span></div>
        <p class="mt-3 text-sm leading-6 text-slate-600">{t("Stripe Identity checks a government-issued photo ID and requires a live selfie that matches the ID photo.")}</p>
        {#if !verification.checks.identity}<button onclick={() => action('start_identity')} disabled={busy} class="mt-4 rounded-lg bg-[#18372f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{t(verification.identity.status === 'REQUIRES_INPUT' ? 'Try identity check again' : 'Start secure identity check')}</button>{/if}
      </article>

      <article class="rounded-sm border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Step 4")}</p><h2 class="mt-1 text-lg font-black">{t("Link a valid card")}</h2></div><span class="rounded-sm px-3 py-1 text-xs font-bold {verification.checks.card ? 'bg-emerald-100 text-[#18372f]' : 'bg-amber-100 text-amber-800'}">{label(verification.card.status)}</span></div>
        <p class="mt-3 text-sm leading-6 text-slate-600">{t("Stripe validates and securely saves the card for auction payments. This verification does not charge the card.")}</p>
        {#if verification.checks.card}<p class="mt-4 font-bold text-slate-800">{verification.card.brand?.toUpperCase()} {t("ending in")} {verification.card.last4}</p>{:else}<button onclick={() => action('start_card')} disabled={busy} class="mt-4 rounded-lg bg-[#18372f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{t("Link card securely")}</button>{/if}
      </article>
    </section>

    <section class="rounded-sm border border-[#ddd6ca] bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-wider text-[#18372f]">{t("Seller verification")}</p><h2 class="mt-1 text-2xl font-black">{t("Tax identity and payout bank")}</h2><p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t("Use your actual country and local identity or business details. The payment provider determines the documents and bank details required for that country.")}</p></div>{#if verification.seller?.complete}<span class="rounded-sm bg-emerald-100 px-3 py-1 text-sm font-bold text-[#18372f]">{t("Complete")}</span>{/if}</div>
      {#if verification.seller}<div class="mt-5 grid gap-3 rounded-sm bg-[#f7f4ee] p-4 text-sm sm:grid-cols-3"><p>{t("Stripe status")}<br /><strong>{label(verification.seller.status)}</strong></p><p>{t("Details submitted")}<br /><strong>{t(verification.seller.detailsSubmitted ? 'Yes' : 'No')}</strong></p><p>{t("Payout bank enabled")}<br /><strong>{t(verification.seller.payoutsEnabled ? 'Yes' : 'No')}</strong></p></div>{/if}
      {#if !verification.seller || verification.seller.status === 'NOT_CONNECTED'}
        <fieldset class="mt-5"><legend class="text-sm font-bold text-slate-800">{t("I will receive payouts as")}</legend><div class="mt-2 flex flex-wrap gap-3"><label class="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"><input type="radio" bind:group={sellerBusinessType} value="INDIVIDUAL" /> {t("Individual (local ID / tax number)")}</label><label class="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"><input type="radio" bind:group={sellerBusinessType} value="BUSINESS" /> {t("Business (company / tax number)")}</label></div></fieldset>
      {/if}
      <label class="mt-5 block text-sm font-bold">{t("Country / payout country")}<select bind:value={sellerCountry} disabled={Boolean(verification.seller && verification.seller.status !== 'NOT_CONNECTED')} class="mt-2 block w-full max-w-md border border-slate-300 p-3"><option value="US">{t("United States")}</option><option value="IL">{t("Israel")}</option><option value="GB">{t("United Kingdom")}</option><option value="CA">{t("Canada")}</option><option value="AU">{t("Australia")}</option><option value="DE">{t("Germany")}</option><option value="FR">{t("France")}</option></select></label>
      {#if sellerCountry === 'IL' && !verification.israelOnboardingAvailable}<p class="mt-3 text-sm text-amber-900">{t("Israeli payouts require provider activation. Contact Pumbi to enable an approved Israeli payout route; do not enter a US address or tax ID.")}</p>{/if}
      {#if sellerCountry === 'IL' && !verification.israelOnboardingAvailable}<RegionalPayoutOptions />{/if}
      <p class="mt-3 text-sm text-slate-600">{t("Stripe Checkout and identity checks open in a language supported by Stripe. Hebrew is available on Pumbi.")}</p>
      <button onclick={() => action('start_seller', { businessType: sellerBusinessType, country: sellerCountry })} disabled={busy || (sellerCountry === 'IL' && !verification.israelOnboardingAvailable)} class="mt-5 rounded-lg bg-[#152c26] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{t(verification.seller && verification.seller.status !== 'NOT_CONNECTED' ? 'Continue Stripe seller onboarding' : 'Start seller verification')}</button>
    </section>

    {#if verification.auctionHouses.length}
      <section class="rounded-sm border bg-white p-6"><h2 class="text-xl font-black">{t("Auction-house verification")}</h2><p class="mt-1 text-sm text-slate-600">{t("Business tax, representative identity, and payout banking are managed in each house’s Stripe onboarding.")}</p><div class="mt-4 space-y-3">{#each verification.auctionHouses as house}<div class="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-[#f7f4ee] p-4"><div><p class="font-bold">{house.name}</p><p class="text-xs text-slate-500">{label(house.onboardingStatus)} {t("· Stripe")} {label(house.stripeConnectStatus)}</p></div><a href="/seller/onboarding" class="text-sm font-bold text-[#18372f]">{t("Manage onboarding →")}</a></div>{/each}</div></section>
    {/if}

    <p class="text-xs leading-5 text-slate-500">{t("Pumbi stores verification results and provider references only. It does not store raw identity documents, selfies, full card numbers, bank account numbers, SSNs, or tax IDs.")}</p>
  </div>
</main>
