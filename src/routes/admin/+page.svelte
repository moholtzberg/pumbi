<script>
  let { data } = $props();

  const sections = [
    { href: '/admin/auctions', label: 'Auctions', value: data.metrics.auctions, detail: `${data.metrics.liveAuctions} live now`, color: 'bg-indigo-50 text-indigo-700' },
    { href: '/admin/auction-houses', label: 'Auction houses', value: data.metrics.auctionHouses, detail: `${data.metrics.pendingHouses} need review`, color: 'bg-violet-50 text-violet-700' },
    { href: '/admin/users', label: 'Users', value: data.metrics.users, detail: 'Accounts and access', color: 'bg-sky-50 text-sky-700' },
    { href: '/admin/lots', label: 'Lots', value: data.metrics.lots, detail: `${data.metrics.pendingLots} submissions pending`, color: 'bg-amber-50 text-amber-700' },
    { href: '/admin/payouts', label: 'Payments', value: data.metrics.pendingPayouts, detail: 'Payouts need attention', color: 'bg-emerald-50 text-emerald-700' }
  ];

  function formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<svelte:head><title>Admin overview | Pumbi</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-7">
  <header>
    <p class="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Platform operations</p>
    <h1 class="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Good to see you, {data.admin.name || 'Admin'}.</h1>
    <p class="mt-2 max-w-2xl text-sm text-slate-500">A focused view of the marketplace, partner operations, catalog, and money movement.</p>
  </header>

  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Admin areas">
    {#each sections as section}
      <a href={section.href} class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
        <span class="inline-flex rounded-lg px-2.5 py-1 text-xs font-bold {section.color}">{section.label}</span>
        <strong class="mt-5 block text-3xl font-black tracking-tight text-slate-950">{section.value}</strong>
        <span class="mt-1 block text-xs text-slate-500">{section.detail}</span>
        <span class="mt-4 block text-sm font-semibold text-indigo-600">Manage <span aria-hidden="true">→</span></span>
      </a>
    {/each}
  </section>

  {#if data.metrics.pendingHouses || data.metrics.pendingLots || data.metrics.pendingPayouts}
    <section class="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 class="font-bold text-amber-950">Needs your attention</h2>
      <div class="mt-3 flex flex-wrap gap-2 text-sm">
        {#if data.metrics.pendingHouses}<a class="rounded-full bg-white px-3 py-1.5 font-semibold text-amber-900 shadow-sm" href="/admin/auction-houses?status=SUBMITTED">{data.metrics.pendingHouses} house reviews</a>{/if}
        {#if data.metrics.pendingLots}<a class="rounded-full bg-white px-3 py-1.5 font-semibold text-amber-900 shadow-sm" href="/admin/auctions#lot-submissions">{data.metrics.pendingLots} lot submissions</a>{/if}
        {#if data.metrics.pendingPayouts}<a class="rounded-full bg-white px-3 py-1.5 font-semibold text-amber-900 shadow-sm" href="/admin/payouts">{data.metrics.pendingPayouts} payout releases</a>{/if}
      </div>
    </section>
  {/if}

  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <div><h2 class="font-bold">Recent auctions</h2><p class="text-xs text-slate-500">Latest activity across the platform</p></div>
      <a href="/admin/auctions" class="text-sm font-semibold text-indigo-600">View all →</a>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[680px] text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-5 py-3">Auction</th><th class="px-5 py-3">Owner</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Activity</th><th class="px-5 py-3">Starts</th></tr></thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.recentAuctions as auction}
            <tr class="hover:bg-slate-50">
              <td class="px-5 py-4"><a class="font-semibold text-slate-950 hover:text-indigo-600" href={`/auctions/${auction.id}`}>{auction.title}</a><div class="text-xs text-slate-500">{auction.type}</div></td>
              <td class="px-5 py-4">{auction.auctionHouse.name}</td>
              <td class="px-5 py-4"><span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{auction.status}</span></td>
              <td class="px-5 py-4 text-slate-600">{auction._count.lots} lots · {auction._count.registrations} bidders</td>
              <td class="px-5 py-4 text-slate-600">{formatDate(auction.startDate)}</td>
            </tr>
          {/each}
          {#if data.recentAuctions.length === 0}<tr><td class="px-5 py-10 text-center text-slate-500" colspan="5">No auctions yet.</td></tr>{/if}
        </tbody>
      </table>
    </div>
  </section>
</div>
