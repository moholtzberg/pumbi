<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let { data } = $props();
  let auction = $derived(data.auction);

  function formatDate(value) {
    return new Date(value).toLocaleString(uiLocale(), {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  let isPrivate = $derived(String(auction.type || 'PRIVATE').toUpperCase() === 'PRIVATE');

  let tiles = $derived([
    {
      href: `/seller/auctions/${auction.id}/control-room`,
      eyebrow: ui("Live sale"),
      title: ui("Control room"),
      body: ui("Claim the auctioneer seat, open lots, and hammer the sale."),
      tone: 'dark'
    },
    {
      href: `/seller/auctions/${auction.id}/lots`,
      eyebrow: ui("Catalog"),
      title: ui("Lots"),
      body: ui("Add, edit, reorder, and mark lots ready for the block."),
      tone: 'light'
    },
    {
      href: `/seller/auctions/${auction.id}/interest`,
      eyebrow: ui("Analytics"),
      title: ui("Interest"),
      body: ui("Unique page views and time on page for this sale and its lots."),
      tone: 'light'
    },
    {
      href: `/seller/auctions/${auction.id}/settings`,
      eyebrow: ui("Setup"),
      title: ui("Auction settings"),
      body: ui("Timing, live stream, gallery, and sale-specific rules."),
      tone: 'light'
    },
    ...(isPrivate
      ? [
          {
            href: `/seller/auctions/${auction.id}/bidders`,
            eyebrow: ui("Access"),
            title: ui("Bidders"),
            body: ui("Review bidders, open profiles, and manage registrations."),
            tone: 'light'
          }
        ]
      : [])
  ]);
</script>

<section class="grid gap-4 sm:grid-cols-3">
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">{ui("Lots")}</p>
    <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{auction.lotCount}</p>
  </div>
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">{ui("Registrations")}</p>
    <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{auction.registrationCount}</p>
  </div>
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">{ui("Window")}</p>
    <p class="mt-2 text-sm leading-6 text-[var(--pumbi-ink-soft)]">
      {formatDate(auction.startDate)}
      <span class="text-[var(--pumbi-muted)]"> → </span>
      {formatDate(auction.endDate)}
    </p>
  </div>
</section>

<section class="mt-6 grid gap-4 md:grid-cols-2">
  {#each tiles as tile}
    <a
      href={tile.href}
      class="group block border p-6 transition hover:-translate-y-0.5 {tile.tone === 'dark'
        ? 'border-[var(--pumbi-forest-deep)] bg-[var(--pumbi-forest-deep)] text-[#f7f4ee]'
        : 'pumbi-panel'}"
    >
      <p class="text-[10px] font-bold uppercase tracking-[0.18em] {tile.tone === 'dark' ? 'text-[#d6b477]' : 'text-[var(--pumbi-terracotta)]'}">
        {tile.eyebrow}
      </p>
      <h2 class="mt-3 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">{tile.title}</h2>
      <p class="mt-2 text-sm leading-6 {tile.tone === 'dark' ? 'text-[#bec9c4]' : 'text-[var(--pumbi-ink-soft)]'}">{tile.body}</p>
      <p class="mt-4 text-xs font-bold uppercase tracking-wide {tile.tone === 'dark' ? 'text-[#d6b477]' : 'text-[var(--pumbi-forest)]'} group-hover:underline">
        {ui("Open →")}
      </p>
    </a>
  {/each}
</section>

{#if auction.description}
  <section class="pumbi-panel mt-6 p-6">
    <p class="pumbi-eyebrow">{ui("Description")}</p>
    <p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--pumbi-ink-soft)]">{auction.description}</p>
  </section>
{/if}
