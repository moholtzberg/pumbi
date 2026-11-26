<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { publicHousePath } from '$lib/utils/houseSlugs.js';
  import { onMount } from 'svelte';
  import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
  import SettingsFields from '$lib/components/settings/SettingsFields.svelte';
  import BidIncrementEditor from '$lib/components/settings/BidIncrementEditor.svelte';
  import CategoryFields from '$lib/components/settings/CategoryFields.svelte';
  import '$lib/components/settings/settings.css';
  let { data } = $props();
  let loading = $state(true);
  let loaded = $state(false);
  let saving = $state(false);
  let failure = $state('');
  let notice = $state('');
  let settings = $state({
    defaultCurrency: data.auctionHouse?.currency?.toUpperCase() || 'USD',
    buyersPremium: 0,
    bidIncrements: [],
    automaticAuctionInitialTimerSeconds: null,
    automaticAuctionTimerResetSeconds: null,
    relistUnsoldLotsAtEnd: false,
    paymentMethods: [],
    termsOfSaleInEnglish: '',
    disclaimerForSellersInEnglish: '',
    aiPrompt: '',
    categoryMetaFields: {},
  });
  const keys = [
    'defaultCurrency',
    'buyersPremium',
    'bidIncrements',
    'automaticAuctionInitialTimerSeconds',
    'automaticAuctionTimerResetSeconds',
    'relistUnsoldLotsAtEnd',
    'paymentMethods',
    'termsOfSaleInEnglish',
    'disclaimerForSellersInEnglish',
    'aiPrompt',
    'categoryMetaFields',
  ];
  const currencies = ['USD', 'ILS', 'EUR', 'GBP', 'CAD', 'AUD'].map(
    (value) => ({
      value,
      label: value === 'ILS' ? ui("ILS · Israeli shekel ₪") : value,
    }),
  );
  const sellingFields = [
    {
      key: 'defaultCurrency',
      label: ui("Currency for new auctions"),
      type: 'select',
      options: currencies,
      help: ui("Existing auction and invoice currencies stay fixed."),
    },
    {
      key: 'buyersPremium',
      label: ui("Buyer premium for new auctions (%)"),
      type: 'number',
      max: 100,
      step: 0.01,
      help: ui("Snapshotted when an auction is created. Existing sales keep their agreed rate."),
    },
  ];
  const timingFields = [
    {
      key: 'automaticAuctionInitialTimerSeconds',
      label: ui("Default time on block (seconds)"),
      type: 'number',
      min: 1,
      step: 1,
      placeholder: ui("Platform default: 60"),
      help: ui("Auction and lot overrides take precedence. Leave blank for 60 seconds."),
    },
    {
      key: 'automaticAuctionTimerResetSeconds',
      label: ui("Bid refresh threshold (seconds)"),
      type: 'number',
      min: 1,
      step: 1,
      placeholder: ui("Platform default: 30"),
      help: ui("A bid arriving with less time left refreshes the timer to this value."),
    },
    {
      key: 'relistUnsoldLotsAtEnd',
      label: ui("Relist unsold lots in one final round"),
      type: 'checkbox',
      wide: true,
      help: ui("Applies to this house. Eligible unsold lots return in the same auction; sold, withdrawn, invoiced, and previously bid-on lots are excluded."),
    },
  ];
  async function load() {
    try {
      if (!data.auctionHouse?.id) throw new Error(ui("Choose an auction house before editing its settings."));
      const response = await fetch(
        `/api/auction-houses/${data.auctionHouse.id}/settings`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || ui("Unable to load settings"));
      settings = {
        ...settings, ...result,
        bidIncrements: Array.isArray(result.bidIncrements) ? result.bidIncrements : [],
        paymentMethods: Array.isArray(result.paymentMethods) ? result.paymentMethods : [],
        categoryMetaFields: result.categoryMetaFields && typeof result.categoryMetaFields === 'object' && !Array.isArray(result.categoryMetaFields) ? result.categoryMetaFields : {}
      };
      loaded = true;
    } catch (err) {
      failure = err.message;
    } finally {
      loading = false;
    }
  }
  onMount(load);
  async function save(event) {
    event.preventDefault();
    saving = true;
    failure = '';
    notice = '';
    try {
      const body = Object.fromEntries(
        keys.map((key) => [key, settings[key] ?? null]),
      );
      const response = await fetch(
        `/api/auction-houses/${data.auctionHouse.id}/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || ui("Unable to save settings"));
      settings = { ...settings, ...result.settings };
      notice = ui("House settings saved.");
    } catch (err) {
      failure = err.message;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{ui("House settings | Pumbi")}</title></svelte:head>
<main
  class="settings-page mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8"
>
  <header class="settings-heading">
    <div>
      <span class="pumbi-eyebrow">{data.auctionHouse?.name}</span>
      <h1>{ui("House settings")}</h1>
      <p>
        {ui("Defaults for this auction house. Each auction shows its own overrides; lot timers can override both.")}
      </p>
    </div>
    <a href="/seller" class="pumbi-btn-secondary">{ui("Back to dashboard")}</a>
  </header>
  {#if data.auctionHouse?.slug}<div class="settings-note mb-6"><strong>{ui("Public auction house address")}</strong><p class="break-all">{publicHousePath(data.auctionHouse.slug)}</p>{#if data.auctionHouse.isActive && data.auctionHouse.onboardingStatus === 'APPROVED'}<a href={publicHousePath(data.auctionHouse.slug)} target="_blank" rel="noreferrer" class="font-semibold underline">{ui("Open public page ↗")}</a>{:else}<p class="text-sm">{ui("This page becomes public when your house is approved and active.")}</p>{/if}</div>{/if}
  <div class="settings-note mb-6">
    <strong>{ui("One place for each setting")}</strong>
    <p>
      {ui("Company details and addresses live in")} <a
        class="underline"
        href="/seller/onboarding"
      >
        {ui("Company profile")}
      </a>{ui(". Manage")} <a class="underline" href="/seller/banking">{ui("banking")}</a>,
      <a class="underline" href="/seller/team">{ui("team access")}</a>{ui(", and")}
      <a class="underline" href="/seller/marketing">{ui("marketing reminders")}</a> {ui("in their dedicated pages.")}
    </p>
  </div>
  {#if failure}<p
      role="alert"
      class="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      {ui(failure)}
    </p>{/if}
  {#if notice}<p
      role="status"
      class="mb-5 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
    >
      {ui(notice)}
    </p>{/if}
  {#if loading}<p class="pumbi-panel p-8">{ui("Loading house settings…")}</p>{:else if !loaded}
    <button type="button" class="pumbi-btn-secondary" onclick={() => { loading = true; failure = ''; load(); }}>{ui("Retry loading")}</button>
  {:else}
    <nav class="settings-nav" aria-label={ui("Settings sections")}>
      <a href="#selling">{ui("Selling defaults")}</a><a href="#increments">
        {ui("Bid increments")}
      </a><a href="#timing">{ui("Live auction defaults")}</a><a href="#payments">
        {ui("Payment methods")}
      </a><a href="#catalog">{ui("Catalog fields")}</a><a href="#terms">{ui("Terms")}</a>
    </nav>
    <form onsubmit={save}>
      <fieldset disabled={saving} class="settings-sections">
        <div id="selling">
          <SettingsSection
            title={ui("Selling defaults")}
            description={ui("Rates and currency are agreed at auction creation, so changing these defaults does not change an existing sale.")}
          >
            <SettingsFields bind:values={settings} fields={sellingFields} />
          </SettingsSection>
        </div>
        <div id="increments">
          <SettingsSection
            title={ui("Bid increment schedule")}
            description={ui("Applies to online bids, automatic counterbids, and phone bids. Auction-specific schedules override this table.")}
          >
            <BidIncrementEditor
              bind:rows={settings.bidIncrements}
              currency={settings.defaultCurrency?.toLowerCase() || 'usd'}
            />
          </SettingsSection>
        </div>
        <div id="timing">
          <SettingsSection
            title={ui("Live auction defaults")}
            description={ui("Timing precedence: lot → auction → house → platform. Starting, hammering, and ending a sale remain in the control room.")}
          >
            <SettingsFields bind:values={settings} fields={timingFields} />
          </SettingsSection>
        </div>
        <div id="payments">
          <SettingsSection
            title={ui("External payment methods")}
            description={ui("Pumbi card checkout is built in. Add the other payment methods buyers may select; the seller confirms these payments. These names do not add surcharges or tax.")}
          >
            <div class="space-y-3">
              {#each settings.paymentMethods as method, index}<div
                  class="flex items-center gap-3"
                >
                  <label class="flex-1">
                    <span class="sr-only">
                      {ui("Payment method")} {index + 1}
                    </span><input
                      type="text"
                      bind:value={method.method}
                      maxlength="100"
                      placeholder={ui("Bank transfer, cash, check…")}
                      required
                    />
                  </label><button
                    type="button"
                    class="settings-remove"
                    onclick={() =>
                      (settings.paymentMethods = settings.paymentMethods.filter(
                        (_, i) => i !== index,
                      ))}
                  >
                    {ui("Remove")}
                  </button>
                </div>{/each}<button
                type="button"
                class="pumbi-btn-secondary"
                onclick={() =>
                  (settings.paymentMethods = [
                    ...settings.paymentMethods,
                    { method: '', percentage: 0, vat: false },
                  ])}
              >
                {ui("Add payment method")}
              </button>
            </div>
          </SettingsSection>
        </div>
        <div id="catalog">
          <SettingsSection
            title={ui("Catalog fields")}
            description={ui("Custom fields for lots in each category. Used when creating and editing catalog entries.")}
          >
            <CategoryFields bind:settings />
          </SettingsSection>
        </div>
        <div id="terms">
          <SettingsSection
            title={ui("Terms for new auctions")}
            description={ui("Terms are snapshotted with each new sale. Existing auctions keep the terms accepted by their participants.")}
          >
            <SettingsFields
              bind:values={settings}
              fields={[
                {
                  key: 'termsOfSaleInEnglish',
                  label: 'Buyer terms',
                  type: 'textarea',
                  wide: true,
                },
                {
                  key: 'disclaimerForSellersInEnglish',
                  label: 'Seller terms',
                  type: 'textarea',
                  wide: true,
                },
              ]}
            />
          </SettingsSection>
        </div>
        <SettingsSection
          title={ui("Catalog writing guidance")}
          description={ui("House instructions for supported AI catalog tools. An auction prompt can provide more specific guidance.")}
        >
          <SettingsFields
            bind:values={settings}
            fields={[
              {
                key: 'aiPrompt',
                label: 'House catalog prompt',
                type: 'textarea',
                wide: true,
              },
            ]}
          />
        </SettingsSection>
      </fieldset>
      <div class="settings-save">
        <p class="settings-help">{ui("Changes take effect after saving.")}</p>
        <button class="pumbi-btn" disabled={saving}>
          {saving ? ui("Saving…") : ui("Save house settings")}
        </button>
      </div>
    </form>
  {/if}
</main>
