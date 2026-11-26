<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import { page } from '$app/stores';

  /**
   * @type {{
   *   auctionId: string;
   *   title?: string;
   *   status?: string;
   *   type?: string;
   * }}
   */
  let { auctionId, title = 'Auction', status = '', type = 'PRIVATE' } = $props();

  let path = $derived($page.url.pathname);
  let isPrivate = $derived(String(type || 'PRIVATE').toUpperCase() === 'PRIVATE');

  let items = $derived([
    { href: `/seller/auctions/${auctionId}`, label: ui("Overview"), exact: true },
    { href: `/seller/auctions/${auctionId}/control-room`, label: ui("Control room") },
    { href: `/seller/auctions/${auctionId}/lots`, label: ui("Lots") },
    { href: `/seller/auctions/${auctionId}/interest`, label: ui("Interest") },
    { href: `/seller/auctions/${auctionId}/settings`, label: ui("Auction settings") },
    ...(isPrivate ? [{ href: `/seller/auctions/${auctionId}/bidders`, label: ui("Bidders") }] : [])
  ]);

  function isActive(item) {
    if (item.exact) return path === item.href;
    return path === item.href || path.startsWith(`${item.href}/`);
  }
</script>

<div class="auction-subnav">
  <div class="auction-subnav__head">
    <div class="min-w-0">
      <a href="/seller" class="pumbi-link text-sm">{ui("← All auctions")}</a>
      <h1 class="mt-2 truncate font-[family-name:var(--pumbi-serif)] text-2xl font-semibold text-[var(--pumbi-ink)] lg:text-3xl">
        {title}
      </h1>
      <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">
        {#if status}<span class="font-semibold uppercase tracking-wide">{uiStatus(status)}</span> · {/if}
        {(type || 'PRIVATE').toUpperCase()} {ui("auction")}
      </p>
    </div>
    <a href={`/auctions/${auctionId}`} class="pumbi-btn-secondary shrink-0" target="_blank" rel="noreferrer">
      {ui("Public page")}
    </a>
  </div>

  <nav class="auction-subnav__tabs" aria-label={ui("Auction sections")}>
    {#each items as item}
      <a href={item.href} class:active={isActive(item)}>{item.label}</a>
    {/each}
  </nav>
</div>

<style>
  .auction-subnav {
    margin-bottom: 1.5rem;
  }

  .auction-subnav__head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .auction-subnav__tabs {
    display: flex;
    gap: 0;
    overflow-x: auto;
    border-bottom: 1px solid var(--pumbi-line);
  }

  .auction-subnav__tabs a {
    flex: 0 0 auto;
    padding: 0.85rem 1rem;
    font: 500 15px Georgia, var(--pumbi-serif), serif;
    color: var(--pumbi-ink-soft);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .auction-subnav__tabs a:hover {
    color: var(--pumbi-ink);
  }

  .auction-subnav__tabs a.active {
    color: var(--pumbi-ink);
    border-bottom-color: var(--pumbi-terracotta);
  }
</style>
