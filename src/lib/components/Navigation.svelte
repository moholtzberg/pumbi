<script>
  import { page } from '$app/stores';
  import { signOut } from '@auth/sveltekit/client';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  let isMenuOpen = $state(false);
  let isAccountOpen = $state(false);
  let session = $state(null);
  let hasAuctionHouse = $state(false);
  let currentUser = $state(null);
  let accountRoot;

  let displayName = $derived(session?.user?.name || session?.user?.email || 'Account');
  let accountHome = $derived(hasAuctionHouse ? '/seller' : '/dashboard');
  let isAdmin = $derived(currentUser?.role?.toUpperCase() === 'PLATFORM_ADMIN');

  $effect(async () => {
    try {
      const response = await fetch('/auth/session');
      session = await response.json();
      if (session?.user?.email) {
        const userResponse = await fetch(`/api/users?email=${encodeURIComponent(session.user.email)}`, { credentials: 'include' });
        if (userResponse.ok) {
          currentUser = await userResponse.json();
          hasAuctionHouse = !!currentUser.auctionHouseId;
        }
      } else {
        currentUser = null;
        hasAuctionHouse = false;
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  });

  $effect(() => {
    // Close menus when the route changes
    $page.url.pathname;
    isMenuOpen = false;
    isAccountOpen = false;
  });

  $effect(() => {
    if (!browser || !isAccountOpen) return;

    function onPointerDown(event) {
      if (accountRoot && !accountRoot.contains(event.target)) {
        isAccountOpen = false;
      }
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') isAccountOpen = false;
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  async function handleLogout() {
    isAccountOpen = false;
    isMenuOpen = false;
    await signOut({ redirect: false });
    goto('/');
  }

  function closeMobile() {
    isMenuOpen = false;
  }
</script>

<nav class="site-nav print:hidden" class:menu-open={isMenuOpen}>
  <div class="nav-inner">
    <a href="/" class="brand" aria-label="Pumbi home"><span>P</span><strong>Pumbi</strong></a>

    <div class="desktop-links">
      <a class:active={$page.url.pathname === '/'} href="/#auctions">Auctions</a>
      <a href="/#category-heading">Categories</a>
      <a href="/#category-heading">Auction houses</a>
      <a href="/#partner">How it works</a>
    </div>

    <div class="desktop-actions">
      {#if session?.user}
        <div class="account-menu" bind:this={accountRoot}>
          <button
            type="button"
            class="account-trigger"
            aria-expanded={isAccountOpen}
            aria-haspopup="menu"
            onclick={() => (isAccountOpen = !isAccountOpen)}
          >
            <span class="account-name">{displayName}</span>
            <svg class="chevron" class:open={isAccountOpen} viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          {#if isAccountOpen}
            <div class="account-dropdown" role="menu">
              <a href={accountHome} role="menuitem" onclick={() => (isAccountOpen = false)}>
                {hasAuctionHouse ? 'Seller home' : 'Dashboard'}
              </a>
              {#if hasAuctionHouse}
                <a href="/seller/sold" role="menuitem" onclick={() => (isAccountOpen = false)}>Sold & shipping</a>
                <a href="/seller/settings" role="menuitem" onclick={() => (isAccountOpen = false)}>House settings</a>
                <a href="/seller/team" role="menuitem" onclick={() => (isAccountOpen = false)}>Team</a>
                <a href="/seller/banking" role="menuitem" onclick={() => (isAccountOpen = false)}>Banking</a>
              {/if}
              {#if !hasAuctionHouse}
                <a href="/dashboard/sell" role="menuitem" onclick={() => (isAccountOpen = false)}>Sell with Pumbi</a>
              {/if}
              {#if isAdmin}
                <a href="/admin" role="menuitem" onclick={() => (isAccountOpen = false)}>Admin</a>
              {/if}
              <button type="button" class="sign-out" role="menuitem" onclick={handleLogout}>Sign out</button>
            </div>
          {/if}
        </div>
      {:else}
        <a href="/auth/login" class="sign-in">Sign in</a>
      {/if}
    </div>

    <button class="menu-toggle" onclick={() => (isMenuOpen = !isMenuOpen)} aria-expanded={isMenuOpen} aria-label="Toggle navigation">
      <span></span><span></span>
    </button>
  </div>

  {#if isMenuOpen}
    <div class="mobile-menu">
      <a href="/#auctions" onclick={closeMobile}>Auctions</a>
      <a href="/#category-heading" onclick={closeMobile}>Categories</a>
      <a href="/#category-heading" onclick={closeMobile}>Auction houses</a>
      <a href="/#partner" onclick={closeMobile}>How it works</a>

      {#if session?.user}
        <p class="mobile-account-label">{displayName}</p>
        <a href={accountHome} onclick={closeMobile}>{hasAuctionHouse ? 'Seller home' : 'Dashboard'}</a>
        {#if hasAuctionHouse}
          <a href="/seller/sold" onclick={closeMobile}>Sold & shipping</a>
          <a href="/seller/settings" onclick={closeMobile}>House settings</a>
          <a href="/seller/team" onclick={closeMobile}>Team</a>
          <a href="/seller/banking" onclick={closeMobile}>Banking</a>
        {/if}
        {#if !hasAuctionHouse}
          <a href="/dashboard/sell" onclick={closeMobile}>Sell with Pumbi</a>
        {/if}
        {#if isAdmin}
          <a href="/admin" onclick={closeMobile}>Admin</a>
        {/if}
        <button type="button" onclick={handleLogout}>Sign out</button>
      {:else}
        <a href="/auth/login" class="mobile-sign-in" onclick={closeMobile}>Sign in</a>
      {/if}
    </div>
  {/if}
</nav>

<style>
  .site-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    height: 70px;
    background: rgba(247, 244, 238, 0.96);
    color: #1a2821;
    border-bottom: 1px solid rgba(48, 58, 52, 0.13);
    backdrop-filter: blur(14px);
  }

  .nav-inner {
    width: min(1240px, calc(100% - 48px));
    height: 100%;
    margin: auto;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .brand {
    display: flex;
    align-items: center;
    width: max-content;
    gap: 10px;
  }

  .brand span {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    background: #a95739;
    color: #fff;
    font: italic 23px Georgia, serif;
  }

  .brand strong {
    font: 600 25px 'Cormorant Garamond', Georgia, serif;
    letter-spacing: -0.02em;
  }

  .desktop-links {
    display: flex;
    align-items: stretch;
    height: 100%;
    gap: 30px;
  }

  .desktop-links a {
    display: flex;
    align-items: center;
    position: relative;
    font: 500 18px Georgia, 'Cormorant Garamond', serif;
    color: #1a2821;
  }

  .desktop-links a:after {
    content: '';
    position: absolute;
    left: 0;
    right: 100%;
    bottom: 0;
    height: 2px;
    background: #a95739;
    transition: 0.2s ease;
  }

  .desktop-links a:hover:after,
  .desktop-links a.active:after {
    right: 0;
  }

  .desktop-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .sign-in {
    font: 500 17px Georgia, 'Cormorant Garamond', serif;
    color: #1a2821;
  }

  .account-menu {
    position: relative;
  }

  .account-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 220px;
    padding: 8px 0;
    font: 500 17px Georgia, 'Cormorant Garamond', serif;
    color: #1a2821;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .account-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
    transition: transform 0.18s ease;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .account-dropdown {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    min-width: 210px;
    padding: 8px 0;
    background: #f7f4ee;
    border: 1px solid #ddd6ca;
    box-shadow: 0 12px 28px rgba(26, 40, 33, 0.12);
    display: grid;
  }

  .account-dropdown a,
  .account-dropdown button {
    display: block;
    width: 100%;
    padding: 11px 16px;
    text-align: left;
    font: 500 16px Georgia, 'Cormorant Garamond', serif;
    color: #1a2821;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .account-dropdown a:hover,
  .account-dropdown button:hover {
    background: rgba(24, 55, 47, 0.06);
  }

  .account-dropdown .sign-out {
    margin-top: 4px;
    border-top: 1px solid #e2dcd1;
    color: #7a3d2a;
  }

  .menu-toggle {
    display: none;
    justify-self: end;
    width: 38px;
    height: 38px;
    position: relative;
  }

  .menu-toggle span {
    position: absolute;
    left: 8px;
    width: 23px;
    height: 1.5px;
    background: currentColor;
    transition: 0.2s ease;
  }

  .menu-toggle span:first-child {
    top: 14px;
  }

  .menu-toggle span:last-child {
    top: 22px;
  }

  .menu-open .menu-toggle span:first-child {
    transform: translateY(4px) rotate(45deg);
  }

  .menu-open .menu-toggle span:last-child {
    transform: translateY(-4px) rotate(-45deg);
  }

  .mobile-menu {
    background: #f7f4ee;
    border-top: 1px solid #ddd6ca;
    padding: 18px 24px 30px;
    display: grid;
  }

  .mobile-menu a,
  .mobile-menu button {
    padding: 14px 0;
    text-align: left;
    border-bottom: 1px solid #e2dcd1;
    font: 500 22px Georgia, 'Cormorant Garamond', serif;
    color: #1a2821;
    background: transparent;
    border-left: 0;
    border-right: 0;
    border-top: 0;
    cursor: pointer;
  }

  .mobile-account-label {
    margin: 18px 0 4px;
    padding-top: 8px;
    border-top: 1px solid #ddd6ca;
    font: 600 13px Arial, sans-serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b746e;
  }

  .mobile-sign-in {
    margin-top: 12px;
  }

  @media (max-width: 900px) {
    .site-nav {
      height: 62px;
    }

    .nav-inner {
      width: min(100% - 32px, 1240px);
      display: flex;
      justify-content: space-between;
    }

    .desktop-links,
    .desktop-actions {
      display: none;
    }

    .menu-toggle {
      display: block;
    }
  }
</style>
