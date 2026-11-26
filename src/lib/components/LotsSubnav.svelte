<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { page } from '$app/stores';

  let { auctionId } = $props();

  let path = $derived($page.url.pathname);
  let base = $derived(`/seller/auctions/${auctionId}/lots`);

  let items = $derived([
    { href: base, label: ui("Catalog"), exact: true },
    { href: `${base}/advanced`, label: ui("Advanced grid") },
    { href: `${base}/bulk`, label: ui("Bulk CSV") },
    { href: `${base}/tools`, label: ui("Banners") }
  ]);

  function isActive(item) {
    if (item.exact) {
      if (path === item.href) return true;
      return /^\/seller\/auctions\/[^/]+\/lots\/[^/]+\/edit$/.test(path);
    }
    return path === item.href || path.startsWith(`${item.href}/`);
  }
</script>

<nav class="lots-subnav" aria-label={ui("Lot tools")}>
  {#each items as item}
    <a href={item.href} class:active={isActive(item)}>{item.label}</a>
  {/each}
</nav>

<style>
  .lots-subnav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 1.25rem;
  }

  .lots-subnav a {
    padding: 0.45rem 0.85rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--pumbi-ink-soft);
    border: 1px solid var(--pumbi-line);
    background: transparent;
  }

  .lots-subnav a:hover {
    color: var(--pumbi-ink);
    border-color: var(--pumbi-ink);
  }

  .lots-subnav a.active {
    color: #fff;
    background: var(--pumbi-forest);
    border-color: var(--pumbi-forest);
  }
</style>
