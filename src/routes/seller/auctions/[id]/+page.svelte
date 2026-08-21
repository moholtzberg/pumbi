<script>
  let { data } = $props();
  let auction = $derived(data.auction);

  function formatDate(value) {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
</script>

<div class="min-h-screen bg-slate-100">
  <div class="border-b border-slate-200 bg-white">
    <div class="container mx-auto px-4 py-6">
      <a href="/seller" class="text-sm font-semibold text-blue-700 hover:underline">← Back to auctions</a>
      <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{auction.auctionHouseName || 'Auction house'}</p>
          <h1 class="mt-1 text-3xl font-black text-slate-950">{auction.title}</h1>
          <p class="mt-2 text-sm text-slate-600">
            <span class="font-semibold uppercase">{auction.status}</span>
            · {(auction.type || 'PRIVATE').toUpperCase()}
            · {auction.lotCount} lots
            · {auction.registrationCount} registrations
          </p>
          <p class="mt-1 text-sm text-slate-500">{formatDate(auction.startDate)} → {formatDate(auction.endDate)}</p>
        </div>
        <a
          href={`/auctions/${auction.id}`}
          class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
          target="_blank"
          rel="noreferrer"
        >
          Public auction page
        </a>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-8">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <a href={`/seller/auctions/${auction.id}/control-room`} class="rounded-2xl bg-slate-950 p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-red-300">Live sale</p>
        <h2 class="mt-3 text-xl font-black">Control room</h2>
        <p class="mt-2 text-sm text-slate-300">Claim the auctioneer seat, start the auction, and move lots along.</p>
      </a>

      <a href={`/seller/auctions/${auction.id}/lots`} class="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Catalog</p>
        <h2 class="mt-3 text-xl font-black text-slate-950">Manage lots</h2>
        <p class="mt-2 text-sm text-slate-600">Add, edit, reorder, and mark lots ready for the sale.</p>
      </a>

      <a href={`/seller/auctions/${auction.id}/settings`} class="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Setup</p>
        <h2 class="mt-3 text-xl font-black text-slate-950">Settings</h2>
        <p class="mt-2 text-sm text-slate-600">Timing, live stream links, gallery layout, and auction rules.</p>
      </a>

      {#if (auction.type || 'PRIVATE').toUpperCase() === 'PRIVATE'}
        <a href={`/seller/auctions/${auction.id}/bidders`} class="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Access</p>
          <h2 class="mt-3 text-xl font-black text-slate-950">Bidder approvals</h2>
          <p class="mt-2 text-sm text-slate-600">Review registrations before private-auction bidding.</p>
        </a>
      {:else}
        <a href="/dashboard/sell" class="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Public</p>
          <h2 class="mt-3 text-xl font-black text-slate-950">Seller submissions</h2>
          <p class="mt-2 text-sm text-slate-600">Independent sellers submit lots into public auctions.</p>
        </a>
      {/if}
    </div>

    {#if auction.description}
      <div class="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 class="font-black text-slate-950">Description</h2>
        <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{auction.description}</p>
      </div>
    {/if}
  </div>
</div>
