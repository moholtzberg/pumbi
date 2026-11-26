<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  let { data } = $props();

  function date(value) {
    return new Date(value).toLocaleDateString(uiLocale());
  }
</script>

<svelte:head><title>{ui("Users | Pumbi Admin")}</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-6">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div><p class="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">{ui("Identity & access")}</p><h1 class="mt-1 text-3xl font-black">{ui("Users")}</h1><p class="mt-1 text-sm text-slate-500">{ui("Review accounts, roles, verification, memberships, and bidding activity.")}</p></div>
    <span class="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">{data.total} {ui("accounts")}</span>
  </header>
  <div class="flex flex-wrap gap-2"><a href="/admin/data/user?create=1" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{ui("Add user")}</a><a href="/admin/data/user" class="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-indigo-700">{ui("Edit / delete users")}</a></div>

  <form class="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto]">
    <input name="q" value={data.filters.search} class="rounded-lg border-slate-300 text-sm" placeholder={ui("Search name or email")} aria-label={ui("Search users")} />
    <select name="role" value={data.filters.role} class="rounded-lg border-slate-300 text-sm" aria-label={ui("Filter by role")}><option value="">{ui("All roles")}</option><option value="BUYER">{ui("Buyer")}</option><option value="SELLER">{ui("Seller")}</option><option value="AUCTIONEER">{ui("Auctioneer")}</option><option value="PLATFORM_ADMIN">{ui("Platform admin")}</option></select>
    <button class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{ui("Filter")}</button>
  </form>

  <section class="overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div class="overflow-x-auto"><table class="w-full min-w-[840px] text-start text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-5 py-3">{ui("User")}</th><th class="px-5 py-3">{ui("Role")}</th><th class="px-5 py-3">{ui("Auction house")}</th><th class="px-5 py-3">{ui("Verification")}</th><th class="px-5 py-3">{ui("Activity")}</th><th class="px-5 py-3">{ui("Joined")}</th></tr></thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.users as user}
          <tr class="hover:bg-slate-50">
            <td class="px-5 py-4"><a href={`/admin/data/user?record=${user.id}`} class="font-semibold text-indigo-700">{user.name || ui("Unnamed user")}</a><div class="text-xs text-slate-500">{user.email}</div></td>
            <td class="px-5 py-4"><span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{uiStatus(user.role.replaceAll('_', ' '))}</span></td>
            <td class="px-5 py-4 text-slate-600">{user.auctionHouse?.name || '—'}<div class="text-xs text-slate-400">{user._count.auctionHouseMemberships} {ui("memberships")}</div></td>
            <td class="px-5 py-4">
              <span class={user.isVerifiedBuyer ? 'font-semibold text-emerald-700' : 'text-slate-500'}>{user.isVerifiedBuyer ? ui("Buyer verified") : ui("Buyer incomplete")}</span>
              <div class="mt-1 text-xs text-slate-400">{ui("Email")} {user.emailVerifiedAt ? '✓' : '—'} {ui("· Phone")} {user.phoneVerifiedAt ? '✓' : '—'} {ui("· ID")} {user.identityVerificationStatus === 'VERIFIED' ? '✓' : '—'} {ui("· Card")} {user.cardVerificationStatus === 'VERIFIED' ? '✓' : '—'}</div>
              {#if user.isVerifiedBidder}<div class="mt-1 text-xs font-semibold text-emerald-700">{ui("Bidder approved")}</div>{/if}
            </td>
            <td class="px-5 py-4 text-slate-600">{user._count.bids} {ui("bids")}</td>
            <td class="px-5 py-4 text-slate-600">{date(user.createdAt)}</td>
          </tr>
        {/each}
        {#if data.users.length === 0}<tr><td colspan="6" class="px-5 py-12 text-center text-slate-500">{ui("No users match these filters.")}</td></tr>{/if}
      </tbody>
    </table></div>
  </section>
</div>
