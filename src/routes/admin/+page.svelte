<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  let { data } = $props();

  const sections = [
    { href: '/admin/auctions', label: ui("Auctions"), value: data.metrics.auctions, detail: ui("{value0} live now", { value0: data.metrics.liveAuctions }), color: 'bg-indigo-50 text-indigo-700' },
    { href: '/admin/auction-houses', label: ui("Auction houses"), value: data.metrics.auctionHouses, detail: ui("{value0} need review", { value0: data.metrics.pendingHouses }), color: 'bg-violet-50 text-violet-700' },
    { href: '/admin/users', label: ui("Users"), value: data.metrics.users, detail: ui("Accounts and access"), color: 'bg-sky-50 text-sky-700' },
    { href: '/admin/trust', label: ui("Trust & Safety"), value: data.metrics.loginFailures, detail: ui("Failed logins in 24 hours"), color: 'bg-rose-50 text-rose-700' },
    { href: '/admin/lots', label: ui("Lots"), value: data.metrics.lots, detail: ui("{value0} submissions pending", { value0: data.metrics.pendingLots }), color: 'bg-amber-50 text-amber-700' },
    { href: '/admin/payouts', label: ui("Payments"), value: data.metrics.pendingPayouts, detail: ui("Payouts need attention"), color: 'bg-emerald-50 text-emerald-700' }
  ];

  function formatDate(value) {
    return new Date(value).toLocaleDateString(uiLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<svelte:head><title>{ui("Admin overview | Pumbi")}</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-7">
  <header>
    <p class="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">{ui("Platform operations")}</p>
    <h1 class="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{ui("Good to see you,")} {data.admin.name || ui("Admin")}.</h1>
    <p class="mt-2 max-w-2xl text-sm text-slate-500">{ui("A focused view of the marketplace, partner operations, catalog, and money movement.")}</p>
  </header>

  <a href="/admin/data" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4"><span><strong class="block text-indigo-950">{ui("Platform data manager")}</strong><span class="mt-1 block text-sm text-indigo-800">{ui("Full record management for users, auctions, lots, invoices, shipments, and every other collection.")}</span></span><span class="text-sm font-semibold text-indigo-700">{ui("Open data manager →")}</span></a>

  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label={ui("Admin areas")}>
    {#each sections as section}
      <a href={section.href} class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
        <span class="inline-flex rounded-lg px-2.5 py-1 text-xs font-bold {section.color}">{ui(section.label)}</span>
        <strong class="mt-5 block text-3xl font-black tracking-tight text-slate-950">{section.value}</strong>
        <span class="mt-1 block text-xs text-slate-500">{ui(section.detail)}</span>
        <span class="mt-4 block text-sm font-semibold text-indigo-600">{ui("Manage")} <span aria-hidden="true">→</span></span>
      </a>
    {/each}
  </section>

  {#if data.metrics.pendingHouses || data.metrics.pendingLots || data.metrics.pendingPayouts}
    <section class="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 class="font-bold text-amber-950">{ui("Needs your attention")}</h2>
      <div class="mt-3 flex flex-wrap gap-2 text-sm">
        {#if data.metrics.pendingHouses}<a class="rounded-full bg-white px-3 py-1.5 font-semibold text-amber-900 shadow-sm" href="/admin/auction-houses?status=SUBMITTED">{data.metrics.pendingHouses} {ui("house reviews")}</a>{/if}
        {#if data.metrics.pendingLots}<a class="rounded-full bg-white px-3 py-1.5 font-semibold text-amber-900 shadow-sm" href="/admin/auction-operations#lot-submissions">{data.metrics.pendingLots} {ui("lot submissions")}</a>{/if}
        {#if data.metrics.pendingPayouts}<a class="rounded-full bg-white px-3 py-1.5 font-semibold text-amber-900 shadow-sm" href="/admin/payouts">{data.metrics.pendingPayouts} {ui("payout releases")}</a>{/if}
      </div>
    </section>
  {/if}

  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <div><h2 class="font-bold">{ui("Recent auctions")}</h2><p class="text-xs text-slate-500">{ui("Latest activity across the platform")}</p></div>
      <a href="/admin/auctions" class="text-sm font-semibold text-indigo-600">{ui("View all →")}</a>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[680px] text-start text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-5 py-3">{ui("Auction")}</th><th class="px-5 py-3">{ui("Owner")}</th><th class="px-5 py-3">{ui("Status")}</th><th class="px-5 py-3">{ui("Activity")}</th><th class="px-5 py-3">{ui("Starts")}</th></tr></thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.recentAuctions as auction}
            <tr class="hover:bg-slate-50">
              <td class="px-5 py-4"><a class="font-semibold text-slate-950 hover:text-indigo-600" href={`/admin/auctions?q=${encodeURIComponent(auction.id)}`}>{auction.title}</a><div class="text-xs text-slate-500">{auction.type}</div></td>
              <td class="px-5 py-4">{auction.auctionHouse.name}</td>
              <td class="px-5 py-4"><span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{uiStatus(auction.status)}</span></td>
              <td class="px-5 py-4 text-slate-600">{auction._count.lots} {ui("lots ·")} {auction._count.registrations} {ui("bidders")}</td>
              <td class="px-5 py-4 text-slate-600">{formatDate(auction.startDate)}</td>
            </tr>
          {/each}
          {#if data.recentAuctions.length === 0}<tr><td class="px-5 py-10 text-center text-slate-500" colspan="5">{ui("No auctions yet.")}</td></tr>{/if}
        </tbody>
      </table>
    </div>
  </section>
</div>
