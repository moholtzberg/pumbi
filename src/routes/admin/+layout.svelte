<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { page } from '$app/stores';
  import LanguageSelector from '$lib/components/LanguageSelector.svelte';

  let { data, children } = $props();

  const navigation = [
    { href: '/admin', label: ui("Overview"), description: ui("Platform health") },
    { href: '/admin/data', label: ui("Data manager"), description: ui("Create, edit & delete all records") },
    { href: '/admin/auctions', label: ui("Auctions"), description: ui("All sales · edit & remove") },
    { href: '/admin/auction-operations', label: ui("Auction operations"), description: ui("Series, policies & submissions") },
    { href: '/admin/auction-houses', label: ui("Auction houses"), description: ui("Partners · edit & remove") },
    { href: '/admin/users', label: ui("Users"), description: ui("Accounts & roles") },
    { href: '/admin/trust', label: ui("Trust & Safety"), description: ui("Login & fraud signals") },
    { href: '/admin/lots', label: ui("Lots"), description: ui("Catalog · edit & remove") },
    { href: '/admin/payouts', label: ui("Payments"), description: ui("Payout releases") }
  ];

  function active(href) {
    return href === '/admin' ? $page.url.pathname === href : $page.url.pathname.startsWith(href);
  }
</script>

<div class="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
  <aside class="border-b border-slate-800 bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:flex lg:flex-col">
    <div class="flex items-center justify-between px-5 py-5 lg:block">
      <a href="/admin" class="block">
        <span class="text-xl font-black tracking-tight">Pumbi</span>
        <span class="ms-2 rounded bg-indigo-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300">{ui("Admin")}</span>
      </a>
      <a href="/" class="text-xs font-semibold text-slate-400 hover:text-white lg:mt-2 lg:block">{ui("← Back to marketplace")}</a>
      <div class="mt-3 text-slate-900"><LanguageSelector /></div>
    </div>

    <nav class="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:overflow-y-auto lg:min-h-0 lg:flex-1 lg:pb-3" aria-label={ui("Admin navigation")}>
      {#each navigation as item}
        <a
          href={item.href}
          class="block min-w-max rounded-lg px-3 py-2.5 transition {active(item.href) ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-950/30' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}"
          aria-current={active(item.href) ? 'page' : undefined}
        >
          <span class="block text-sm font-semibold">{ui(item.label)}</span>
          <span class="hidden text-xs text-slate-400 lg:block {active(item.href) ? '!text-indigo-100' : ''}">{ui(item.description)}</span>
        </a>
      {/each}
    </nav>

    <div class="hidden border-t border-slate-800 px-5 py-4 lg:mt-auto lg:shrink-0 lg:block">
      <p class="truncate text-sm font-semibold">{data.admin.name || data.admin.email}</p>
      <p class="truncate text-xs text-slate-400">{data.admin.email}</p>
    </div>
  </aside>

  <main class="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    {@render children()}
  </main>
</div>
