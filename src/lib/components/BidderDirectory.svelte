<script>
  let { directory, house, canViewProfiles = false, basePath = '/seller/bidders' } = $props();
  const profileHref = id => `/seller/bidders/${encodeURIComponent(id)}?houseId=${encodeURIComponent(house.id)}`;
  function pageHref(page) {
    const params = new URLSearchParams({ houseId: house.id, q: directory.q || '', page: String(page) });
    if (directory.auctionId) params.set('auctionId', directory.auctionId);
    if (directory.blockedOnly) params.set('blocked', '1');
    return `${basePath}?${params}`;
  }
</script>
<section class="pumbi-panel space-y-5 p-5 sm:p-6">
  <div class="flex flex-wrap items-end justify-between gap-4"><div><h2 class="text-xl font-semibold">Bidder directory</h2><p class="mt-1 text-sm text-[var(--pumbi-muted)]">{directory.count} bidder(s) · Includes people who bid without registering.</p></div>
    <form method="GET" action={basePath} class="flex flex-wrap items-end gap-3">
      <input type="hidden" name="houseId" value={house.id} />
      {#if directory.auctionId}<input type="hidden" name="auctionId" value={directory.auctionId} />{/if}
      <label class="text-xs font-semibold">Search bidders<input name="q" value={directory.q} placeholder="Name, email, or phone" class="mt-1 block rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm font-normal" /></label>
      <label class="flex items-center gap-2 py-2 text-sm"><input type="checkbox" name="blocked" value="1" checked={directory.blockedOnly} />Blocked only</label>
      <button class="pumbi-btn-secondary">Search</button>
    </form>
  </div>
  <div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b border-[var(--pumbi-line)] text-xs uppercase text-[var(--pumbi-muted)]"><tr><th class="p-3">Bidder</th><th class="p-3">Phone</th><th class="p-3">Bid events</th><th class="p-3">Access</th><th class="p-3">Profile</th></tr></thead><tbody class="divide-y divide-[var(--pumbi-line)]">
    {#each directory.bidders as bidder (bidder.id)}<tr><td class="p-3">{#if canViewProfiles}<a class="font-bold text-[var(--pumbi-forest)] underline decoration-[var(--pumbi-line)] underline-offset-4" href={profileHref(bidder.id)}>{bidder.name || bidder.email}</a>{:else}<strong>{bidder.name || bidder.email}</strong>{/if}<p class="mt-1 text-xs text-[var(--pumbi-muted)]">{bidder.email}</p></td><td class="p-3">{bidder.phone || '—'}</td><td class="p-3">{bidder.bidCount}</td><td class="p-3"><span class="px-2 py-1 text-xs font-bold {bidder.blocked ? 'bg-red-50 text-red-800' : 'bg-[#e8eee9] text-[#18372f]'}">{bidder.blocked ? 'Blocked by house' : 'Not blocked'}</span></td><td class="p-3">{#if canViewProfiles}<a href={profileHref(bidder.id)} class="font-semibold text-[#a95739] underline underline-offset-4">View history & payments →</a>{:else}<span class="text-xs text-[var(--pumbi-muted)]">Owner / admin access</span>{/if}</td></tr>
    {:else}<tr><td colspan="5" class="p-8 text-center text-[var(--pumbi-muted)]">No matching bidders. Participants appear after registering, bidding, or winning a lot.</td></tr>{/each}
  </tbody></table></div>
  <nav class="flex items-center justify-between gap-3 text-sm" aria-label="Bidder directory pages"><a href={pageHref(Math.max(1,directory.page - 1))} aria-disabled={directory.page <= 1} class:pointer-events-none={directory.page <= 1} class:opacity-40={directory.page <= 1}>← Previous</a><span>Page {directory.page} of {Math.max(1, Math.ceil(directory.count / directory.pageSize))}</span><a href={pageHref(directory.page + 1)} aria-disabled={directory.page * directory.pageSize >= directory.count} class:pointer-events-none={directory.page * directory.pageSize >= directory.count} class:opacity-40={directory.page * directory.pageSize >= directory.count}>Next →</a></nav>
</section>
