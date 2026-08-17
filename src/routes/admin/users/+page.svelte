<script>
  let { data } = $props();

  function date(value) {
    return new Date(value).toLocaleDateString();
  }
</script>

<svelte:head><title>Users | Pumbi Admin</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-6">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div><p class="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Identity & access</p><h1 class="mt-1 text-3xl font-black">Users</h1><p class="mt-1 text-sm text-slate-500">Review accounts, roles, verification, memberships, and bidding activity.</p></div>
    <span class="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">{data.total} accounts</span>
  </header>

  <form class="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto]">
    <input name="q" value={data.filters.search} class="rounded-lg border-slate-300 text-sm" placeholder="Search name or email" aria-label="Search users" />
    <select name="role" value={data.filters.role} class="rounded-lg border-slate-300 text-sm" aria-label="Filter by role"><option value="">All roles</option><option value="BUYER">Buyer</option><option value="SELLER">Seller</option><option value="AUCTIONEER">Auctioneer</option><option value="PLATFORM_ADMIN">Platform admin</option></select>
    <button class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filter</button>
  </form>

  <section class="overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div class="overflow-x-auto"><table class="w-full min-w-[840px] text-left text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-5 py-3">User</th><th class="px-5 py-3">Role</th><th class="px-5 py-3">Auction house</th><th class="px-5 py-3">Verification</th><th class="px-5 py-3">Activity</th><th class="px-5 py-3">Joined</th></tr></thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.users as user}
          <tr class="hover:bg-slate-50">
            <td class="px-5 py-4"><div class="font-semibold text-slate-950">{user.name || 'Unnamed user'}</div><div class="text-xs text-slate-500">{user.email}</div></td>
            <td class="px-5 py-4"><span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{user.role.replaceAll('_', ' ')}</span></td>
            <td class="px-5 py-4 text-slate-600">{user.auctionHouse?.name || '—'}<div class="text-xs text-slate-400">{user._count.auctionHouseMemberships} memberships</div></td>
            <td class="px-5 py-4"><span class={user.isVerifiedBuyer ? 'text-emerald-700' : 'text-slate-400'}>{user.isVerifiedBuyer ? 'Buyer verified' : 'Not verified'}</span>{#if user.isVerifiedBidder}<div class="text-xs text-emerald-700">Bidder verified</div>{/if}</td>
            <td class="px-5 py-4 text-slate-600">{user._count.bids} bids</td>
            <td class="px-5 py-4 text-slate-600">{date(user.createdAt)}</td>
          </tr>
        {/each}
        {#if data.users.length === 0}<tr><td colspan="6" class="px-5 py-12 text-center text-slate-500">No users match these filters.</td></tr>{/if}
      </tbody>
    </table></div>
  </section>
</div>
