<script>
  let { data } = $props();
  const date = (value) => value ? new Date(value).toLocaleDateString() : 'Not submitted';

  function statusClass(status) {
    if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-800';
    if (status === 'REJECTED') return 'bg-red-100 text-red-800';
    if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') return 'bg-amber-100 text-amber-900';
    return 'bg-slate-100 text-slate-700';
  }
</script>

<svelte:head><title>Auction houses | Pumbi Admin</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-6">
  <header class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Partner operations</p><h1 class="mt-1 text-3xl font-black">Auction houses</h1><p class="mt-1 text-sm text-slate-500">Track onboarding, catalog activity, team access, and payment readiness.</p></div><span class="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">{data.total} partners</span></header>

  <form class="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto]">
    <input name="q" value={data.filters.search} class="rounded-lg border-slate-300 text-sm" placeholder="Search auction houses" aria-label="Search auction houses" />
    <select name="status" value={data.filters.status} class="rounded-lg border-slate-300 text-sm" aria-label="Filter onboarding status"><option value="">All onboarding states</option>{#each data.statuses as status}<option value={status}>{status.replaceAll('_', ' ')}</option>{/each}</select>
    <button class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filter</button>
  </form>

  <section class="grid gap-4 xl:grid-cols-2">
    {#each data.auctionHouses as house}
      <article class="rounded-2xl border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div><h2 class="text-lg font-bold">{house.name}</h2><p class="text-xs text-slate-500">{house.legalName || house.slug}{house.country ? ` · ${house.country}` : ''}</p></div>
          <span class="rounded-full px-2.5 py-1 text-xs font-bold {statusClass(house.onboardingStatus)}">{house.onboardingStatus.replaceAll('_', ' ')}</span>
        </div>
        <div class="mt-5 grid grid-cols-4 gap-3 border-y py-4 text-center">
          <div><strong class="block text-lg">{house._count.auctions}</strong><span class="text-[11px] text-slate-500">Auctions</span></div>
          <div><strong class="block text-lg">{house._count.memberships}</strong><span class="text-[11px] text-slate-500">Members</span></div>
          <div><strong class="block text-lg">{house._count.locations}</strong><span class="text-[11px] text-slate-500">Locations</span></div>
          <div><strong class="block text-lg">{house._count.documents}</strong><span class="text-[11px] text-slate-500">Documents</span></div>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>Submitted {date(house.onboardingSubmittedAt)} · Stripe {house.stripeConnectStatus.replaceAll('_', ' ')}</span>
          <a href={`/admin/auction-houses/${house.id}`} class="rounded-lg border px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Open partner →</a>
        </div>
      </article>
    {/each}
    {#if data.auctionHouses.length === 0}<p class="rounded-2xl border bg-white p-12 text-center text-slate-500 xl:col-span-2">No auction houses match these filters.</p>{/if}
  </section>
</div>
