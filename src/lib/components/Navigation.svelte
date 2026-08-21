<script>
  import { page } from '$app/stores';
  import { signOut } from '@auth/sveltekit/client';
  import { goto } from '$app/navigation';

  let isMenuOpen = $state(false);
  let session = $state(null);
  let hasAuctionHouse = $state(false);
  let currentUser = $state(null);

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
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  });

  async function handleLogout() {
    await signOut({ redirect: false });
    goto('/');
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
      <a href="/#auctions" class="icon-link" aria-label="Search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg></a>
      {#if session?.user}
        {#if !hasAuctionHouse}<a href="/dashboard/sell" class="account-link">Sell</a>{/if}
        {#if currentUser?.role?.toUpperCase() === 'PLATFORM_ADMIN'}<a href="/admin" class="account-link">Admin</a>{/if}
        <a href={hasAuctionHouse ? '/seller' : '/dashboard'} class="account-link">{session.user.name || 'My account'}</a>
        <button onclick={handleLogout} class="text-action">Sign out</button>
      {:else}
        <a href="/auth/login" class="account-link">Sign in</a>
        <a href="/auth/register" class="join-button">Join Pumbi <span>→</span></a>
      {/if}
    </div>

    <button class="menu-toggle" onclick={() => isMenuOpen = !isMenuOpen} aria-expanded={isMenuOpen} aria-label="Toggle navigation">
      <span></span><span></span>
    </button>
  </div>

  {#if isMenuOpen}
    <div class="mobile-menu">
      <a href="/#auctions" onclick={() => isMenuOpen = false}>Auctions</a>
      <a href="/#category-heading" onclick={() => isMenuOpen = false}>Categories</a>
      <a href="/#category-heading" onclick={() => isMenuOpen = false}>Auction houses</a>
      <a href="/#partner" onclick={() => isMenuOpen = false}>How it works</a>
      {#if session?.user}
        {#if !hasAuctionHouse}<a href="/dashboard/sell" onclick={() => isMenuOpen = false}>Sell with Pumbi</a>{/if}
        {#if currentUser?.role?.toUpperCase() === 'PLATFORM_ADMIN'}<a href="/admin" onclick={() => isMenuOpen = false}>Platform admin</a>{/if}
        <a href={hasAuctionHouse ? '/seller' : '/dashboard'} onclick={() => isMenuOpen = false}>My account</a>
        <button onclick={() => { isMenuOpen = false; handleLogout(); }}>Sign out</button>
      {:else}
        <a href="/auth/login" onclick={() => isMenuOpen = false}>Sign in</a>
        <a href="/auth/register" class="mobile-join" onclick={() => isMenuOpen = false}>Join Pumbi →</a>
      {/if}
    </div>
  {/if}
</nav>

<style>
  .site-nav { position: sticky; top: 0; z-index: 50; height: 70px; background: rgba(247,244,238,.96); color: #1a2821; border-bottom: 1px solid rgba(48,58,52,.13); backdrop-filter: blur(14px); }
  .nav-inner { width: min(1240px, calc(100% - 48px)); height: 100%; margin: auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
  .brand { display: flex; align-items: center; width: max-content; gap: 10px; }
  .brand span { display: grid; place-items: center; width: 34px; height: 34px; background: #a95739; color: #fff; font: italic 23px Georgia,serif; }
  .brand strong { font: 600 25px 'Cormorant Garamond',Georgia,serif; letter-spacing: -.02em; }
  .desktop-links { display: flex; align-items: stretch; height: 100%; gap: 30px; }
  .desktop-links a { display: flex; align-items: center; position: relative; font: 500 18px Georgia, 'Cormorant Garamond', serif; color: #1a2821; }
  .desktop-links a:after { content: ''; position: absolute; left: 0; right: 100%; bottom: 0; height: 2px; background: #a95739; transition: .2s ease; }
  .desktop-links a:hover:after, .desktop-links a.active:after { right: 0; }
  .desktop-actions { display: flex; justify-content: flex-end; align-items: center; gap: 21px; }
  .icon-link svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; }
  .account-link, .text-action { font: 500 17px Georgia, 'Cormorant Garamond', serif; color: #1a2821; }
  .join-button { display: flex; gap: 17px; padding: 12px 16px; background: #18372f; color: #fff; font-size: 11px; font-weight: 850; letter-spacing: .04em; text-transform: uppercase; border-radius: 0; }
  .menu-toggle { display: none; justify-self: end; width: 38px; height: 38px; position: relative; }
  .menu-toggle span { position: absolute; left: 8px; width: 23px; height: 1.5px; background: currentColor; transition: .2s ease; }
  .menu-toggle span:first-child { top: 14px; } .menu-toggle span:last-child { top: 22px; }
  .menu-open .menu-toggle span:first-child { transform: translateY(4px) rotate(45deg); }
  .menu-open .menu-toggle span:last-child { transform: translateY(-4px) rotate(-45deg); }
  .mobile-menu { background: #f7f4ee; border-top: 1px solid #ddd6ca; padding: 18px 24px 30px; display: grid; }
  .mobile-menu a, .mobile-menu button { padding: 14px 0; text-align: left; border-bottom: 1px solid #e2dcd1; font: 500 22px Georgia, 'Cormorant Garamond', serif; color: #1a2821; }
  .mobile-menu .mobile-join { margin-top: 15px; padding: 15px; text-align: center; background: #18372f; color: #fff; border: 0; font: 800 12px Arial,sans-serif; letter-spacing: .04em; text-transform: uppercase; }
  @media (max-width: 900px) {
    .site-nav { height: 62px; }
    .nav-inner { width: min(100% - 32px,1240px); display: flex; justify-content: space-between; }
    .desktop-links, .desktop-actions { display: none; }
    .menu-toggle { display: block; }
  }
</style>
