<script>
  import { page } from '$app/stores';

  let { data, children } = $props();

  const navigation = [
    { href: '/admin', label: 'Overview', description: 'Platform health' },
    { href: '/admin/auctions', label: 'Auctions', description: 'Series & submissions' },
    { href: '/admin/auction-houses', label: 'Auction houses', description: 'Partners & onboarding' },
    { href: '/admin/users', label: 'Users', description: 'Accounts & roles' },
    { href: '/admin/trust', label: 'Trust & Safety', description: 'Login & fraud signals' },
    { href: '/admin/lots', label: 'Lots', description: 'Catalog inventory' },
    { href: '/admin/payouts', label: 'Payments', description: 'Payout releases' }
  ];

  function active(href) {
    return href === '/admin' ? $page.url.pathname === href : $page.url.pathname.startsWith(href);
  }
</script>

<div class="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
  <aside class="border-b border-slate-800 bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
    <div class="flex items-center justify-between px-5 py-5 lg:block">
      <a href="/admin" class="block">
        <span class="text-xl font-black tracking-tight">Pumbi</span>
        <span class="ml-2 rounded bg-indigo-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300">Admin</span>
      </a>
      <a href="/" class="text-xs font-semibold text-slate-400 hover:text-white lg:mt-2 lg:block">← Back to marketplace</a>
    </div>

    <nav class="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0" aria-label="Admin navigation">
      {#each navigation as item}
        <a
          href={item.href}
          class="block min-w-max rounded-lg px-3 py-2.5 transition {active(item.href) ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-950/30' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}"
          aria-current={active(item.href) ? 'page' : undefined}
        >
          <span class="block text-sm font-semibold">{item.label}</span>
          <span class="hidden text-xs text-slate-400 lg:block {active(item.href) ? '!text-indigo-100' : ''}">{item.description}</span>
        </a>
      {/each}
    </nav>

    <div class="hidden border-t border-slate-800 px-5 py-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
      <p class="truncate text-sm font-semibold">{data.admin.name || data.admin.email}</p>
      <p class="truncate text-xs text-slate-400">{data.admin.email}</p>
    </div>
  </aside>

  <main class="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    {@render children()}
  </main>
</div>
