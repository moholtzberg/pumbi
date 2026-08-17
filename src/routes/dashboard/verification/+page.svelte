<script>
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
      if (name === 'send_email') { emailCodeSent = true; successMessage = `Code sent to ${verification.user.email}.`; }
      if (name === 'send_phone') { phoneCodeSent = true; successMessage = `Code sent to ${verification.user.phone}.`; }
      if (name === 'check_email' || name === 'check_phone') {
        successMessage = 'Verification completed.';
        await invalidateAll();
      }
    } catch (error) {
      errorMessage = error.message;
    } finally {
      busy = '';
    }
  }

  const label = (value) => (value || 'NOT_STARTED').replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
</script>

<svelte:head><title>Account verification | Pumbi</title></svelte:head>

<main class="min-h-screen bg-slate-50">
  <div class="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div><p class="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">Trust & safety</p><h1 class="mt-1 text-3xl font-black text-slate-950">Account verification</h1><p class="mt-2 max-w-2xl text-slate-600">Complete each secure check to buy and bid. Sensitive identity, card, bank, and tax details are collected by Stripe, not stored by Pumbi.</p></div>
      <div class="rounded-2xl bg-violet-950 px-5 py-4 text-white"><p class="text-xs font-bold uppercase tracking-wider text-violet-300">Buyer progress</p><p class="mt-1 text-2xl font-black">{verification.completedCount} of 4</p></div>
    </header>

    {#if successMessage}<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{successMessage}</div>{/if}
    {#if errorMessage}<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{errorMessage}</div>{/if}

    {#if verification.user.isVerifiedBuyer}
      <section class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><div class="flex gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-xl text-white">✓</span><div><h2 class="text-xl font-black text-emerald-950">Buyer verification complete</h2><p class="mt-1 text-sm text-emerald-800">Your verified status is active. Bidder access may still require auction approval.</p></div></div></section>
    {/if}

    <section class="grid gap-4 md:grid-cols-2">
      <article class="rounded-2xl border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Step 1</p><h2 class="mt-1 text-lg font-black">Verify email</h2></div><span class="rounded-full px-3 py-1 text-xs font-bold {verification.checks.email ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">{verification.checks.email ? 'Verified' : 'Required'}</span></div>
        <p class="mt-3 text-sm text-slate-600">Confirm access to <strong>{verification.user.email}</strong>.</p>
        {#if !verification.checks.email}
          {#if emailCodeSent}<div class="mt-4 flex gap-2"><input aria-label="Email verification code" inputmode="numeric" autocomplete="one-time-code" placeholder="Verification code" bind:value={emailCode} class="min-w-0 flex-1 rounded-lg border-slate-300" /><button onclick={() => action('check_email', { code: emailCode })} disabled={busy || !emailCode} class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirm</button></div>{/if}
          <button onclick={() => action('send_email')} disabled={busy} class="mt-4 text-sm font-bold text-violet-700 disabled:opacity-50">{emailCodeSent ? 'Send a new code' : 'Send email code'} →</button>
        {/if}
      </article>

      <article class="rounded-2xl border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Step 2</p><h2 class="mt-1 text-lg font-black">Verify phone</h2></div><span class="rounded-full px-3 py-1 text-xs font-bold {verification.checks.phone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">{verification.checks.phone ? 'Verified' : 'Required'}</span></div>
        <p class="mt-3 text-sm text-slate-600">{verification.user.phone ? `Confirm ${verification.user.phone} by SMS.` : 'Add a mobile phone number with its country code.'}</p>
        {#if !verification.user.phone}<a href="/dashboard/profile" class="mt-4 inline-flex text-sm font-bold text-violet-700">Add phone number →</a>{:else if !verification.checks.phone}
          {#if phoneCodeSent}<div class="mt-4 flex gap-2"><input aria-label="Phone verification code" inputmode="numeric" autocomplete="one-time-code" placeholder="Verification code" bind:value={phoneCode} class="min-w-0 flex-1 rounded-lg border-slate-300" /><button onclick={() => action('check_phone', { code: phoneCode })} disabled={busy || !phoneCode} class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirm</button></div>{/if}
          <button onclick={() => action('send_phone')} disabled={busy} class="mt-4 text-sm font-bold text-violet-700 disabled:opacity-50">{phoneCodeSent ? 'Send a new code' : 'Send SMS code'} →</button>
        {/if}
      </article>

      <article class="rounded-2xl border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Step 3</p><h2 class="mt-1 text-lg font-black">Photo ID + selfie</h2></div><span class="rounded-full px-3 py-1 text-xs font-bold {verification.checks.identity ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">{label(verification.identity.status)}</span></div>
        <p class="mt-3 text-sm leading-6 text-slate-600">Stripe Identity checks a government-issued photo ID and requires a live selfie that matches the ID photo.</p>
        {#if !verification.checks.identity}<button onclick={() => action('start_identity')} disabled={busy} class="mt-4 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{verification.identity.status === 'REQUIRES_INPUT' ? 'Try identity check again' : 'Start secure identity check'}</button>{/if}
      </article>

      <article class="rounded-2xl border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Step 4</p><h2 class="mt-1 text-lg font-black">Link a valid card</h2></div><span class="rounded-full px-3 py-1 text-xs font-bold {verification.checks.card ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">{label(verification.card.status)}</span></div>
        <p class="mt-3 text-sm leading-6 text-slate-600">Stripe validates and securely saves the card for auction payments. This verification does not charge the card.</p>
        {#if verification.checks.card}<p class="mt-4 font-bold text-slate-800">{verification.card.brand?.toUpperCase()} ending in {verification.card.last4}</p>{:else}<button onclick={() => action('start_card')} disabled={busy} class="mt-4 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Link card securely</button>{/if}
      </article>
    </section>

    <section class="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-wider text-blue-600">Seller verification</p><h2 class="mt-1 text-2xl font-black">Tax identity and payout bank</h2><p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Required before receiving seller proceeds. Individuals provide their legal identity and SSN/TIN; businesses provide their legal business and EIN/tax ID. Bank and tax details stay with Stripe Connect.</p></div>{#if verification.seller?.complete}<span class="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">Complete</span>{/if}</div>
      {#if verification.seller}<div class="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><p>Stripe status<br /><strong>{label(verification.seller.status)}</strong></p><p>Details submitted<br /><strong>{verification.seller.detailsSubmitted ? 'Yes' : 'No'}</strong></p><p>Payout bank enabled<br /><strong>{verification.seller.payoutsEnabled ? 'Yes' : 'No'}</strong></p></div>{/if}
      {#if !verification.seller || verification.seller.status === 'NOT_CONNECTED'}
        <fieldset class="mt-5"><legend class="text-sm font-bold text-slate-800">I will receive payouts as</legend><div class="mt-2 flex flex-wrap gap-3"><label class="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"><input type="radio" bind:group={sellerBusinessType} value="INDIVIDUAL" /> Individual (SSN/TIN)</label><label class="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"><input type="radio" bind:group={sellerBusinessType} value="BUSINESS" /> Business (EIN/tax ID)</label></div></fieldset>
      {/if}
      <button onclick={() => action('start_seller', { businessType: sellerBusinessType })} disabled={busy} class="mt-5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{verification.seller && verification.seller.status !== 'NOT_CONNECTED' ? 'Continue Stripe seller onboarding' : 'Start seller verification'}</button>
    </section>

    {#if verification.auctionHouses.length}
      <section class="rounded-2xl border bg-white p-6"><h2 class="text-xl font-black">Auction-house verification</h2><p class="mt-1 text-sm text-slate-600">Business tax, representative identity, and payout banking are managed in each house’s Stripe onboarding.</p><div class="mt-4 space-y-3">{#each verification.auctionHouses as house}<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><p class="font-bold">{house.name}</p><p class="text-xs text-slate-500">{label(house.onboardingStatus)} · Stripe {label(house.stripeConnectStatus)}</p></div><a href="/seller/onboarding" class="text-sm font-bold text-violet-700">Manage onboarding →</a></div>{/each}</div></section>
    {/if}

    <p class="text-xs leading-5 text-slate-500">Pumbi stores verification results and provider references only. It does not store raw identity documents, selfies, full card numbers, bank account numbers, SSNs, or tax IDs.</p>
  </div>
</main>
