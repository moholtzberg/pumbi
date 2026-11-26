<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { page } from '$app/stores';

  let { auctionHouse = null, limited = false } = $props();

  const links = [
    { href: '/seller', label: ui("Auctions"), match: (path) => path === '/seller' || path.startsWith('/seller/auctions') },
    { href: '/seller/sold', label: ui("Sold"), match: (path) => path.startsWith('/seller/sold') },
    { href: '/seller/bidders', label: ui("Bidders"), match: (path) => path.startsWith('/seller/bidders') },
    { href: '/seller/marketing', label: ui("Marketing"), match: (path) => path.startsWith('/seller/marketing') },
    { href: '/seller/settings', label: ui("House settings"), match: (path) => path === '/seller/settings' },
    { href: '/seller/team', label: ui("Team"), match: (path) => path.startsWith('/seller/team') },
    { href: '/seller/banking', label: ui("Banking"), match: (path) => path.startsWith('/seller/banking') }
  ];

  let path = $derived($page.url.pathname);
  let needsOnboarding = $derived(
    Boolean(auctionHouse && auctionHouse.onboardingStatus && auctionHouse.onboardingStatus !== 'APPROVED')
  );
</script>

<header class="seller-nav print:hidden">
  <div class="seller-nav__inner">
    <div class="seller-nav__brand">
      <p class="pumbi-eyebrow">{ui("Seller")}</p>
      <a href="/seller" class="seller-nav__house">
        {auctionHouse?.name || ui("Auction house")}
      </a>
    </div>

    {#if !limited}
      <nav class="seller-nav__links" aria-label={ui("Seller")}>
        {#each links as link}
          <a href={link.href} class:active={link.match(path)}>{link.label}</a>
        {/each}
      </nav>
    {:else}
      <nav class="seller-nav__links" aria-label={ui("Seller onboarding")}>
        <a href="/seller/onboarding" class:active={path.startsWith('/seller/onboarding')}>{ui("Onboarding")}</a>
        <a href="/seller/team" class:active={path.startsWith('/seller/team')}>{ui("Team")}</a>
        <a href="/seller/banking" class:active={path.startsWith('/seller/banking')}>{ui("Banking")}</a>
      </nav>
    {/if}

    <div class="seller-nav__aside">
      {#if needsOnboarding}
        <a href="/seller/onboarding" class="seller-nav__chip">{ui("Finish onboarding")}</a>
      {/if}
      <a href="/" class="seller-nav__public">{ui("Public site")}</a>
    </div>
  </div>
</header>

<style>
  .seller-nav {
    position: sticky;
    top: 70px;
    z-index: 40;
    background: rgba(247, 244, 238, 0.96);
    border-bottom: 1px solid var(--pumbi-line);
    backdrop-filter: blur(14px);
  }

  .seller-nav__inner {
    width: min(1240px, calc(100% - 48px));
    margin: 0 auto;
    min-height: 58px;
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .seller-nav__brand {
    min-width: 0;
    flex: 0 1 auto;
  }

  .seller-nav__house {
    display: block;
    margin-top: 2px;
    font: 600 1.15rem var(--pumbi-serif);
    color: var(--pumbi-ink);
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }

  .seller-nav__links {
    display: flex;
    align-items: stretch;
    gap: 18px;
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
  }

  .seller-nav__links a {
    display: flex;
    align-items: center;
    position: relative;
    padding: 18px 0;
    font: 500 15px Georgia, var(--pumbi-serif), serif;
    color: var(--pumbi-ink-soft);
    white-space: nowrap;
  }

  .seller-nav__links a:after {
    content: '';
    position: absolute;
    left: 0;
    right: 100%;
    bottom: 0;
    height: 2px;
    background: var(--pumbi-terracotta);
    transition: 0.2s ease;
  }

  .seller-nav__links a:hover,
  .seller-nav__links a.active {
    color: var(--pumbi-ink);
  }

  .seller-nav__links a:hover:after,
  .seller-nav__links a.active:after {
    right: 0;
  }

  .seller-nav__aside {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .seller-nav__chip {
    padding: 8px 12px;
    background: var(--pumbi-terracotta);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .seller-nav__public {
    font: 500 14px Georgia, var(--pumbi-serif), serif;
    color: var(--pumbi-ink-soft);
  }

  .seller-nav__public:hover {
    color: var(--pumbi-terracotta);
  }

  @media (max-width: 900px) {
    .seller-nav {
      top: 62px;
    }

    .seller-nav__inner {
      width: min(100% - 32px, 1240px);
      flex-wrap: wrap;
      padding: 10px 0 0;
      gap: 8px 16px;
    }

    .seller-nav__links {
      order: 3;
      width: 100%;
      gap: 14px;
      border-top: 1px solid var(--pumbi-line-soft);
    }

    .seller-nav__links a {
      padding: 12px 0;
      font-size: 14px;
    }

    .seller-nav__house {
      max-width: 160px;
      font-size: 1rem;
    }
  }
</style>
