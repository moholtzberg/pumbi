<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
  import SettingsFields from '$lib/components/settings/SettingsFields.svelte';
  import BidIncrementEditor from '$lib/components/settings/BidIncrementEditor.svelte';
  import GallerySettings from '$lib/components/settings/GallerySettings.svelte';
  import '$lib/components/settings/settings.css';
  let auction = $state(null);
  let loading = $state(true);
  let busy = $state('');
  let failure = $state('');
  let notice = $state('');
  let info = $state({
    house: {},
    increments: { rows: [], source: 'lot' },
    buyerPremium: 0,
    timers: {},
  });
  let details = $state({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    imageUrl: '',
  });
  let settings = $state({
    bidIncrements: [],
    requireRegistrationToBid: false,
    autoAdvanceNextLot: false,
    buyerPaysShipping: true,
    automaticAuctionInitialTimerSeconds: null,
    automaticAuctionTimerResetSeconds: null,
    liveVideoUrl: '',
    liveVideoTitle: '',
    liveAudioUrl: '',
    liveAudioTitle: '',
    galleryTemplate: 'card-grid',
    galleryTemplateSettings: {
      cardGridColumns: 3,
      cardGridShowDescription: true,
      cardGridShowStartingBid: true,
      sliderAutoPlay: false,
      sliderAutoPlayInterval: 3000,
      sliderShowDots: true,
      sliderShowArrows: true,
      overlayTextPosition: 'bottom',
      overlayTextOpacity: 0.8,
      overlayButtonStyle: 'white',
      minimalGridColumns: 5,
      minimalGridShowDescription: false,
      masonryColumns: 4,
      masonryVaryHeights: true,
    },
    aiPrompt: '',
  });
  const keys = [
    'bidIncrements',
    'requireRegistrationToBid',
    'autoAdvanceNextLot',
    'buyerPaysShipping',
    'automaticAuctionInitialTimerSeconds',
    'automaticAuctionTimerResetSeconds',
    'liveVideoUrl',
    'liveVideoTitle',
    'liveAudioUrl',
    'liveAudioTitle',
    'galleryTemplate',
    'galleryTemplateSettings',
    'aiPrompt',
  ];
  function localDate(value) {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  async function api(url, body) {
    const response = await fetch(
      url,
      body
        ? {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {},
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.message || result.error || 'Unable to save settings',
      );
    return result;
  }
  async function load() {
    try {
      const [sale, config] = await Promise.all([
        api(`/api/auctions/${$page.params.id}`),
        api(`/api/auctions/${$page.params.id}/settings`),
      ]);
      auction = sale;
      details = {
        title: sale.title,
        description: sale.description || '',
        startDate: localDate(sale.startDate),
        endDate: localDate(sale.endDate),
        imageUrl: sale.imageUrl || '',
      };
      info = config._inheritance || info;
      settings = {
        ...settings,
        ...Object.fromEntries(
          keys
            .filter((key) => config[key] !== undefined)
            .map((key) => [key, config[key]]),
        ),
        galleryTemplateSettings: {
          ...settings.galleryTemplateSettings,
          ...config.galleryTemplateSettings,
        },
        bidIncrements: config.bidIncrements || [],
        buyerPaysShipping: config.buyerPaysShipping ?? info.buyerPaysShipping ?? true,
      };
    } catch (err) {
      failure = err.message;
    } finally {
      loading = false;
    }
  }
  onMount(load);
  async function save(event, kind) {
    event.preventDefault();
    busy = kind;
    failure = '';
    notice = '';
    try {
      if (kind === 'details') {
        const updated = await api(`/api/auctions/${auction.id}`, {
          ...details,
          startDate: new Date(details.startDate).toISOString(),
          endDate: new Date(details.endDate).toISOString(),
          imageUrl: details.imageUrl || null,
        });
        auction = updated.auction || updated;
      } else {
        const result = await api(
          `/api/auctions/${auction.id}/settings`,
          Object.fromEntries(keys.map((key) => [key, settings[key] ?? null])),
        );
        settings = { ...settings, ...result.settings };
      }
      notice =
        kind === 'details'
          ? 'Auction details saved.'
          : 'Auction settings saved.';
    } catch (err) {
      failure = err.message;
    } finally {
      busy = '';
    }
  }
</script>

<svelte:head><title>Auction settings | Pumbi</title></svelte:head>
<div class="settings-page">
  <header class="settings-heading">
    <div>
      <span class="pumbi-eyebrow">This auction only</span>
      <h1>Auction settings</h1>
      <p>
        Override house defaults for this sale. Start, hammer, and end the
        auction in the control room.
      </p>
    </div>
    {#if auction}<a
        href={`/seller/auctions/${auction.id}/control-room`}
        class="pumbi-btn-secondary"
      >
        Control room
      </a>{/if}
  </header>
  {#if failure}<p
      role="alert"
      class="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      {failure}
    </p>{/if}
  {#if notice}<p
      role="status"
      class="mb-5 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
    >
      {notice}
    </p>{/if}
  {#if loading}<p class="pumbi-panel p-8">
      Loading auction settings…
    </p>{:else if auction}
    <div class="settings-note mb-6">
      <strong>{auction.title}</strong>
      <p>
        Currency: {(auction.currency || 'usd').toUpperCase()} · Buyer premium: {info.buyerPremium}%
        · Status: {auction.status}
      </p>
      <p>
        Currency and agreed fees stay fixed for this sale. Change defaults for
        new sales in <a class="underline" href="/seller/settings">
          House settings
        </a>. Company details, banking, and marketing are managed in the house
        portal.
      </p>
    </div>
    <nav class="settings-nav" aria-label="Auction settings sections">
      <a href="#details">Sale details</a><a href="#bidding">Bidding</a><a
        href="#timers"
      >
        Timers
      </a><a href="#stream">Stream</a><a href="#gallery">Catalog appearance</a>
    </nav>
    <form
      id="details"
      onsubmit={(event) => save(event, 'details')}
      class="mb-6"
    >
      <fieldset disabled={Boolean(busy)}>
        <SettingsSection
          title="Sale details"
          description="Scheduled dates describe the catalog window. Live floor controls remain in the control room."
        >
          <SettingsFields
            bind:values={details}
            fields={[
              { key: 'title', label: 'Auction title', wide: true },
              {
                key: 'description',
                label: 'Description',
                type: 'textarea',
                wide: true,
              },
              { key: 'imageUrl', label: 'Auction image URL', wide: true },
            ]}
          />
          <div class="settings-grid mt-5">
            <label>
              <span>Scheduled start</span><input
                type="datetime-local"
                bind:value={details.startDate}
                required
              />
            </label><label>
              <span>Scheduled end</span><input
                type="datetime-local"
                bind:value={details.endDate}
                required
              />
            </label>
          </div>
          <div class="settings-save">
            <button class="pumbi-btn-secondary" disabled={Boolean(busy)}>
              {busy === 'details' ? 'Saving…' : 'Save sale details'}
            </button>
          </div>
        </SettingsSection>
      </fieldset>
    </form>
    <form onsubmit={(event) => save(event, 'settings')}>
      <fieldset disabled={Boolean(busy)} class="settings-sections">
        <div id="bidding">
          <SettingsSection
            title="Bidding and access"
            description="One registration rule controls approval and verification. Proxy bidding is built into bid entry; it follows the same increment rules as phone bids."
          >
            <SettingsFields
              bind:values={settings}
              fields={[
                {
                  key: 'requireRegistrationToBid',
                  label: 'Require registration before bidding',
                  type: 'checkbox',
                  wide: true,
                  help: 'When off, a signed-in user can bid unless blocked by the house. When on, buyer verification and the auction’s registration or approval rules apply.',
                },
                {
                  key: 'autoAdvanceNextLot',
                  label:
                    'Automatically open the next ready lot after hammer down',
                  type: 'checkbox',
                  wide: true,
                },
                {
                  key: 'buyerPaysShipping',
                  label: 'Buyer pays shipping',
                  type: 'checkbox',
                  wide: true,
                  help: 'Buyers choose a shipping rate before payment. When off, the house handles shipping charges.',
                },
              ]}
            />
            <div class="mt-6 border-t border-[var(--pumbi-line)] pt-6">
              <h3 class="mb-4 text-lg font-semibold">Bid increment schedule</h3>
              {#if info.increments.source === 'policy'}<p class="settings-note">
                  This public auction follows its published platform-policy
                  increment schedule. Change the policy for future sales in
                  platform administration.
                </p>
                <p class="mt-3 text-sm">
                  {info.increments.rows
                    .map((row) => `${row.from} → +${row.increment}`)
                    .join(' · ')}
                </p>{:else}<BidIncrementEditor
                  scope="auction"
                  bind:rows={settings.bidIncrements}
                  inherited={info.house.bidIncrements || []}
                  currency={auction.currency || 'usd'}
                />{/if}
            </div>
          </SettingsSection>
        </div>
        <div id="timers">
          <SettingsSection
            title="Lot timing"
            description="Lot overrides take precedence over this page, followed by house and platform defaults. Blank values inherit."
          >
            <SettingsFields
              bind:values={settings}
              fields={[
                {
                  key: 'automaticAuctionInitialTimerSeconds',
                  label: 'Time on block (seconds)',
                  type: 'number',
                  min: 1,
                  step: 1,
                  placeholder: `House default: ${info.house.automaticAuctionInitialTimerSeconds || 60}`,
                },
                {
                  key: 'automaticAuctionTimerResetSeconds',
                  label: 'Bid refresh threshold (seconds)',
                  type: 'number',
                  min: 1,
                  step: 1,
                  placeholder: `House default: ${info.house.automaticAuctionTimerResetSeconds || 30}`,
                  help: 'With less time remaining, a new bid refreshes the timer to this duration.',
                },
              ]}
            />
            <p class="settings-help mt-4">
              Relisting unsold lots is a house-wide option in <a
                class="underline"
                href="/seller/settings#timing"
              >
                House settings
              </a>.
            </p>
          </SettingsSection>
        </div>
        <div id="stream">
          <SettingsSection
            title="Live stream"
            description="Broadcast your camera from the control room. These optional URLs provide an external video or audio feed."
          >
            <SettingsFields
              bind:values={settings}
              fields={[
                { key: 'liveVideoUrl', label: 'External video URL' },
                { key: 'liveVideoTitle', label: 'Video title' },
                { key: 'liveAudioUrl', label: 'External audio URL' },
                { key: 'liveAudioTitle', label: 'Audio title' },
              ]}
            />
          </SettingsSection>
        </div>
        <div id="gallery">
          <SettingsSection
            title="Catalog appearance"
            description="Choose the lot gallery layout for this auction."
          >
            <GallerySettings bind:settings />
            <p class="settings-help">
              Create promotional artwork in <a
                class="underline"
                href={`/seller/auctions/${auction.id}/lots/tools`}
              >
                Banner tools
              </a>. Company branding is managed in Company profile.
            </p>
          </SettingsSection>
        </div>
        <SettingsSection
          title="Catalog writing guidance"
          description="Optional instructions specific to this auction. Leave blank to use the house prompt."
        >
          <SettingsFields
            bind:values={settings}
            fields={[
              {
                key: 'aiPrompt',
                label: 'Auction catalog prompt',
                type: 'textarea',
                wide: true,
                placeholder: info.house.aiPrompt || 'Use house guidance',
              },
            ]}
          />
        </SettingsSection>
      </fieldset>
      <div class="settings-save">
        <p class="settings-help">
          Live settings changes preserve the current lot, timers, and relist
          state.
        </p>
        <button class="pumbi-btn" disabled={Boolean(busy)}>
          {busy === 'settings' ? 'Saving…' : 'Save auction settings'}
        </button>
      </div>
    </form>
  {/if}
</div>
