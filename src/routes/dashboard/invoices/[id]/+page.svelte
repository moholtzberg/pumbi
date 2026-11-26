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

  import { shippingDefaults, shippingKey } from '$lib/utils/addresses.js';
  import InvoiceHouseContact from '$lib/components/InvoiceHouseContact.svelte';
  let { data } = $props();

  let busy = $state('');
  let errorMessage = $state('');
  let successMessage = $state(
    data.paidFlag ? 'Payment received — thank you.' : data.canceledFlag ? 'Checkout canceled.' : ''
  );
  let invoice = $state(data.invoice);
  let rates = $state(data.rates || []);
  let selectedRateId = $state(data.selectedRateId || '');
  let address = $state({ ...data.shippingAddress });
  let selectedAddress = $state(data.selectedAddressId || 'custom');
  let ratedAddress = $state(shippingKey(data.shippingAddress));
  let addressChanged = $derived(shippingKey(address) !== ratedAddress);
  let shippingNotReady = $derived(invoice.buyerPaysShipping && (!selectedRateId || addressChanged));
  function chooseAddress() {
    const saved = data.savedAddresses.find(row => row.id === selectedAddress);
    if (saved) address = shippingDefaults(data.user, [{ ...saved, isDefault: true }]).address;
    rates = []; selectedRateId = '';
  }

  function money(amount) {
    return new Intl.NumberFormat($page.data.locale === 'he' ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency: (invoice.currency || 'usd').toUpperCase()
    }).format(Number(amount || 0));
  }

  async function api(action, payload = {}) {
    busy = action;
    errorMessage = '';
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...payload })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || ui("Failed to {value0}", { value0: action }));
      return body;
    } catch (err) {
      errorMessage = err.message || ui("Something went wrong");
      throw err;
    } finally {
      busy = '';
    }
  }

  async function getRates() {
    try {
      const requestedAddress = { ...address };
      const result = await api('quote_shipping', { address: requestedAddress });
      ratedAddress = shippingKey(requestedAddress);
      rates = result.rates || [];
      selectedRateId = '';
      successMessage = rates.length ? ui("Shipping options loaded.") : ui("No rates returned.");
    } catch {
      /* shown via errorMessage */
    }
  }

  async function chooseRate(rateId) {
    try {
      const result = await api('select_shipping', { rateId });
      selectedRateId = rateId;
      invoice = result.invoice;
      successMessage = ui("Shipping option selected.");
    } catch {
      /* shown */
    }
  }

  async function payPumbi() {
    try {
      const result = await api('pay_pumbi');
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      throw new Error(ui("Checkout URL missing"));
    } catch {
      /* shown */
    }
  }

  async function payExternal(method) {
    try {
      const result = await api('pay_external', { method });
      invoice = result.invoice;
      successMessage = ui("Marked as paying by {value0}. The seller will confirm when payment arrives.", { value0: method });
    } catch {
      /* shown */
    }
  }

  let unpaid = $derived(['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'].includes(invoice.status));
</script>

<main class="min-h-screen bg-[#f7f4ee]">
  <div class="mx-auto max-w-3xl px-4 py-8">
    <a href="/dashboard#won-lots" class="text-sm font-semibold text-[#18372f]">{t("← Back to dashboard")}</a>
    <header class="mt-4">
      <p class="text-xs font-bold uppercase tracking-[0.16em] text-[#a95739]">{t("Invoice")} {invoice.number}</p>
      <h1 class="mt-1 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold text-[#1a2821]">
        {t("Lot #")}{invoice.lot?.lotNumber} · {invoice.lot?.title}
      </h1>
      <p class="mt-1 text-sm text-[#435048]">
        {invoice.auctionHouse?.name || ui("Seller")} · {invoice.auction?.title}
      </p>
    </header>
    <InvoiceHouseContact house={invoice.auctionHouse} />

    {#if errorMessage}
      <div class="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{ui(errorMessage)}</div>
    {/if}
    {#if successMessage}
      <div class="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ui(successMessage)}</div>
    {/if}

    <section class="mt-6 grid gap-4 border border-[#ddd6ca] bg-white p-5 sm:grid-cols-[96px_1fr]">
      <div class="h-24 overflow-hidden border border-[#ddd6ca] bg-[#efe8dc]">
        {#if invoice.lot?.imageUrl}
          <img src={invoice.lot.imageUrl} alt="" class="h-full w-full object-cover" />
        {/if}
      </div>
      <div class="space-y-1 text-sm">
        <div class="flex justify-between gap-4"><span class="text-[#435048]">{t("Hammer")}</span><strong>{money(invoice.hammerPrice)}</strong></div>
        <div class="flex justify-between gap-4"><span class="text-[#435048]">{t("Buyer’s premium (")}{invoice.buyerPremiumRate}%)</span><strong>{money(invoice.buyerPremiumAmount)}</strong></div>
        <div class="flex justify-between gap-4"><span class="text-[#435048]">{t("Shipping")}</span><strong>{money(invoice.shippingAmount)}</strong></div>
        <div class="flex justify-between gap-4 border-t border-[#e2dcd1] pt-2 text-base"><span class="font-semibold">{t("Total")}</span><strong>{money(invoice.totalAmount)}</strong></div>
        <p class="pt-2 text-xs font-bold uppercase tracking-wide text-[#18372f]">{t("Status ·")} {uiStatus(invoice.status.replaceAll('_', ' '))}</p>
      </div>
    </section>

    {#if unpaid && invoice.buyerPaysShipping}
      <section class="mt-6 border border-[#ddd6ca] bg-white p-5">
        <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">{t("Shipping address")}</h2>
        <p class="mt-1 text-sm text-[#435048]">{t("Buyer pays shipping — choose a rate before checkout. The label is created for the seller automatically after payment.")}</p>
        {#if data.savedAddresses?.length}
          <label class="mt-4 block text-sm font-semibold">{t("Saved shipping address")}<select bind:value={selectedAddress} onchange={chooseAddress} disabled={Boolean(busy)} class="mt-2 w-full border border-[#ddd6ca] bg-white p-3"><option value="custom">{t("Use a different address")}</option>{#each data.savedAddresses as saved}<option value={saved.id}>{saved.label}{saved.isDefault ? ui(" (default)") : ''} · {saved.street1}, {saved.city}</option>{/each}</select></label>
        {/if}
        <a href="/dashboard/profile#saved-addresses" class="mt-3 inline-block text-xs font-semibold text-[#18372f] underline">{t("Manage saved addresses")}</a>
        {#if !address.city || !address.zip}<p class="mt-2 text-xs text-slate-600">{t("Confirm the city, region, and postal code from your profile address before requesting rates.")}</p>{/if}
        {#if addressChanged}<p class="mt-2 text-xs text-amber-800">{t("Get new shipping rates for this address before paying.")}</p>{/if}
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-sm sm:col-span-2">{t("Name")}<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.name} /></label>
          <label class="text-sm sm:col-span-2">{t("Street")}<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.street1} /></label>
          <label class="text-sm sm:col-span-2">{t("Street 2")}<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.street2} /></label>
          <label class="text-sm">{t("City")}<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.city} /></label>
          <label class="text-sm">{t("State")}<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.state} /></label>
          <label class="text-sm">{t("ZIP")}<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.zip} /></label>
          <label class="text-sm">{t("Country")}<input class="mt-1 w-full border border-[#ddd6ca] bg-[#f7f4ee] px-3 py-2" bind:value={address.country} /></label>
        </div>
        <button
          type="button"
          class="mt-4 bg-[#18372f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          disabled={Boolean(busy)}
          onclick={getRates}
        >
          {t(busy === 'quote_shipping' ? 'Getting rates…' : 'Get shipping rates')}
        </button>

        {#if rates.length}
          <div class="mt-4 divide-y divide-[#e2dcd1] border border-[#ddd6ca]">
            {#each rates as rate}
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-[#f7f4ee] {selectedRateId === rate.objectId ? 'bg-[#e8eee9]' : ''}"
                disabled={Boolean(busy) || addressChanged}
                onclick={() => chooseRate(rate.objectId)}
              >
                <div>
                  <p class="font-semibold text-[#1a2821]">{rate.provider} · {rate.servicelevel}</p>
                  <p class="text-xs text-[#435048]">{rate.durationTerms || (rate.estimatedDays ? ui("{value0} days", { value0: rate.estimatedDays }) : ui("Transit time varies"))}</p>
                </div>
                <p class="font-bold">{money(rate.amount)}</p>
              </button>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if unpaid}
      <section class="mt-6 border border-[#ddd6ca] bg-white p-5">
        <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">{t("Pay")}</h2>
        <p class="mt-1 text-sm text-[#435048]">{t("Pay with Pumbi (Stripe Checkout) is always available. Other options come from the seller’s settings.")}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="bg-[#a95739] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            disabled={Boolean(busy) || shippingNotReady}
            onclick={payPumbi}
          >
            {busy === 'pay_pumbi' ? ui("Starting checkout…") : ui("Pay with Pumbi")}
          </button>
          {#each data.paymentMethods.filter((m) => m.channel === 'EXTERNAL') as method}
            <button
              type="button"
              class="border border-[#18372f] px-4 py-2.5 text-sm font-bold text-[#18372f] disabled:opacity-50"
              disabled={Boolean(busy) || shippingNotReady}
              onclick={() => payExternal(method.method)}
            >
              {t("Pay by")} {method.label}
            </button>
          {/each}
        </div>
      </section>
    {:else if invoice.status === 'PAID'}
      <section class="mt-6 border border-[#ddd6ca] bg-white p-5">
        <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">{t("Paid")}</h2>
        <p class="mt-1 text-sm text-[#435048]">
          {t("Paid")} {invoice.paidAt ? new Date(invoice.paidAt).toLocaleString(uiLocale()) : ''}
          {#if invoice.paymentChannel === 'PUMBI_STRIPE'} {t("via Pumbi")}{/if}
          {#if invoice.externalPaymentMethod} · {invoice.externalPaymentMethod}{/if}
        </p>
        {#if invoice.shipment?.trackingNumber}
          <p class="mt-3 text-sm">
            {t("Tracking:")} <a class="font-semibold text-[#18372f] underline" href={invoice.shipment.trackingUrl || '#'} target="_blank" rel="noreferrer">{invoice.shipment.trackingNumber}</a>
            · {uiStatus(invoice.shipment.status.replaceAll('_', ' '))}
          </p>
        {/if}
      </section>
    {/if}
  </div>
</main>
