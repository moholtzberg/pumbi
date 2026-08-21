<script>
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();
  let now = $state(Date.now());
  let removing = $state('');

  const money = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(Number(value || 0));
  const firstName = data.user.firstName || data.user.name?.trim().split(/\s+/)[0] || 'there';
  const tasks = [
    ...(!data.user.firstName ? [{ title: 'Add your first name', detail: 'Tell us how to address you.', href: '/dashboard/profile' }] : []),
    ...(!data.user.lastName ? [{ title: 'Add your last name', detail: 'Complete your account identity.', href: '/dashboard/profile' }] : []),
    ...(!data.user.phone ? [{ title: 'Add a phone number', detail: 'Auction teams may need to reach you.', href: '/dashboard/profile' }] : []),
    ...(!data.user.address ? [{ title: 'Add your address', detail: 'Required for buyer verification.', href: '/dashboard/profile' }] : []),
    ...(!data.user.emailVerifiedAt ? [{ title: 'Verify your email', detail: 'Enter the one-time code sent to your inbox.', href: '/dashboard/verification' }] : []),
    ...(!data.user.phoneVerifiedAt ? [{ title: 'Verify your phone', detail: 'Confirm your mobile number by SMS.', href: '/dashboard/verification' }] : []),
    ...(data.user.identityVerificationStatus !== 'VERIFIED' ? [{ title: 'Verify photo ID and selfie', detail: 'Complete the secure Stripe Identity check.', href: '/dashboard/verification', pending: data.user.identityVerificationStatus === 'PENDING' }] : []),
    ...(data.user.cardVerificationStatus !== 'VERIFIED' ? [{ title: 'Link a valid credit card', detail: 'Securely validate a card without a charge.', href: '/dashboard/verification', pending: data.user.cardVerificationStatus === 'PENDING' }] : []),
    ...(!data.user.isVerifiedBidder ? [{
      title: 'Bidder approval is still needed',
      detail: data.user.isVerifiedBuyer ? 'An auction administrator must approve bidding access.' : 'Complete all buyer verification checks first.',
      pending: data.user.isVerifiedBuyer
    }] : [])
  ];

  onMount(() => {
    const timer = setInterval(() => now = Date.now(), 1000);
    return () => clearInterval(timer);
  });

  function countdown(lot) {
    if (lot.auction.status === 'LIVE') return 'On the block now';
    if (lot.auction.status === 'ENDED' || lot.status === 'SOLD' || lot.status === 'UNSOLD') return 'Auction ended';
    if (lot.auction.status === 'CANCELLED') return 'Auction cancelled';
    const difference = new Date(lot.auction.startDate).getTime() - now;
    if (difference <= 0) return 'Starting now';
    const days = Math.floor(difference / 86400000);
    const hours = Math.floor((difference % 86400000) / 3600000);
    const minutes = Math.floor((difference % 3600000) / 60000);
    const seconds = Math.floor((difference % 60000) / 1000);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }

  async function unwatch(lotId) {
    removing = lotId;
    try {
      const response = await fetch(`/api/lots/${lotId}/watch`, { method: 'DELETE' });
      if (response.ok) await invalidateAll();
    } finally {
      removing = '';
    }
  }
</script>

<svelte:head><title>Dashboard | Pumbi</title></svelte:head>

<main class="min-h-screen bg-[#f7f4ee]">
  <div class="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm font-bold uppercase tracking-[0.18em] text-[#a95739]">Your Pumbi</p>
        <h1 class="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Welcome, {firstName}</h1>
        <p class="mt-1 text-sm text-slate-500">Here’s what needs your attention and what’s coming up.</p>
      </div>
      <div class="flex items-center gap-3">
        {#if data.controlRoomAuctions?.length}
          <a href="#control-rooms" class="rounded-sm border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-700 hover:bg-red-100">
            Control rooms
          </a>
        {/if}
        <a href="/dashboard/profile" aria-label="View or edit profile" title="View or edit profile" class="grid h-11 w-11 place-items-center rounded-sm border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-[#c4b8a8] hover:text-[#18372f]">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
        </a>
      </div>
    </header>

    {#if data.controlRoomAuctions?.length}
      <section id="control-rooms" class="rounded-sm border border-[#18372f] bg-[#152c26] p-5 text-white shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-red-300">Auctioneer</p>
            <h2 class="mt-1 text-xl font-black">Control rooms</h2>
            <p class="mt-1 text-sm text-slate-400">Start live sales and move lots along for auctions you can run.</p>
          </div>
          {#if data.user.role === 'PLATFORM_ADMIN' || data.user.role === 'SELLER' || data.user.role === 'AUCTIONEER'}
            <a href="/seller" class="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">Seller portal</a>
          {/if}
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {#each data.controlRoomAuctions as auction}
            <a
              href={`/seller/auctions/${auction.id}/control-room`}
              class="rounded-sm border border-white/10 bg-white/5 p-4 transition hover:border-red-400/40 hover:bg-white/10"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="rounded-sm px-2 py-0.5 text-[10px] font-black uppercase tracking-wide {auction.status === 'LIVE' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-200'}">
                  {auction.status}
                </span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{(auction.type || 'PRIVATE').toUpperCase()}</span>
              </div>
              <h3 class="mt-3 truncate font-black text-white">{auction.title}</h3>
              <p class="mt-1 truncate text-xs text-slate-400">
                {auction.auctionHouseName || 'Auction house'} · {auction.lotCount} lots
              </p>
              <p class="mt-3 text-sm font-bold text-red-300">
                {auction.status === 'LIVE' && auction.hasStarted
                  ? auction.isClaimedAuctioneer
                    ? 'Open your control room →'
                    : 'Open control room →'
                  : 'Prepare / start sale →'}
              </p>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <div class="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
      <section class="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div><p class="text-xs font-bold uppercase tracking-wider text-amber-600">To do</p><h2 class="mt-1 text-xl font-black text-slate-950">Finish setting up</h2></div>
          <span class="rounded-sm bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{tasks.length} remaining</span>
        </div>

        {#if tasks.length}
          <ol class="mt-5 space-y-3">
            {#each tasks as task}
              <li class="flex gap-3 rounded-sm border border-slate-100 bg-[#f7f4ee] p-3.5">
                <span class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-sm border-2 {task.pending ? 'border-blue-300 bg-[#efe8dc]' : 'border-amber-300 bg-white'}">
                  {#if task.pending}<span class="h-2 w-2 rounded-sm bg-[#efe8dc]0"></span>{/if}
                </span>
                <div class="min-w-0 flex-1"><p class="font-bold text-slate-900">{task.title}</p><p class="mt-0.5 text-sm leading-5 text-slate-500">{task.detail}</p></div>
                {#if task.href}<a href={task.href} aria-label={task.title} class="self-center rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-white hover:text-[#a95739]">›</a>{/if}
              </li>
            {/each}
          </ol>
        {:else}
          <div class="mt-5 rounded-sm bg-[#e8eee9] p-5 text-center"><span class="mx-auto grid h-10 w-10 place-items-center rounded-sm bg-[#18372f] text-xl text-white">✓</span><p class="mt-3 font-bold text-[#152c26]">You’re all set</p><p class="mt-1 text-sm text-[#18372f]">There are no outstanding account tasks.</p></div>
        {/if}
      </section>

      <section class="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><p class="text-xs font-bold uppercase tracking-wider text-[#a95739]">Watchlist</p><h2 class="mt-1 text-xl font-black text-slate-950">Lots you’re watching</h2></div>
          <a href="/" class="text-sm font-bold text-[#18372f] hover:text-[#152c26]">Browse auctions →</a>
        </div>

        {#if data.watchedLots.length}
          <div class="mt-5 divide-y divide-slate-100">
            {#each data.watchedLots as lot (lot.id)}
              <article class="grid gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
                <a href={`/lots/${lot.id}`} class="block h-20 overflow-hidden rounded-sm bg-slate-100">
                  {#if lot.imageUrl}<img src={lot.imageUrl} alt={lot.title} class="h-full w-full object-cover" />{:else}<span class="grid h-full place-items-center text-2xl text-slate-300">◇</span>{/if}
                </a>
                <div class="min-w-0"><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Lot #{lot.lotNumber} · {lot.auction.title}</p><a href={`/lots/${lot.id}`} class="mt-1 block truncate font-bold text-slate-950 hover:text-[#18372f]">{lot.title}</a><p class="mt-1 text-sm text-slate-500">Current bid <strong class="text-slate-800">{money(lot.currentBid || lot.startingBid)}</strong></p></div>
                <div class="flex items-center justify-between gap-3 sm:block sm:text-right"><div><p class="text-xs font-bold uppercase tracking-wide text-[#a95739]">On the block in</p><p class="mt-1 font-black tabular-nums text-[#18372f]">{countdown(lot)}</p></div><button type="button" onclick={() => unwatch(lot.id)} disabled={removing === lot.id} class="mt-2 text-xs font-semibold text-slate-400 hover:text-red-600 disabled:opacity-50">Remove</button></div>
              </article>
            {/each}
          </div>
        {:else}
          <div class="mt-5 rounded-sm border border-dashed border-slate-200 px-5 py-10 text-center"><span class="text-3xl text-slate-300">♡</span><p class="mt-2 font-bold text-slate-800">Your watchlist is empty</p><p class="mt-1 text-sm text-slate-500">Open a lot and select Watch lot to track it here.</p></div>
        {/if}
      </section>
    </div>

    <section class="grid gap-4 sm:grid-cols-4">
      <div class="rounded-sm border bg-white p-4"><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Bids placed</p><p class="mt-1 text-2xl font-black text-slate-950">{data.stats.totalBids}</p></div>
      <div class="rounded-sm border bg-white p-4"><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Currently leading</p><p class="mt-1 text-2xl font-black text-[#18372f]">{data.stats.leadingBids ?? data.stats.winningBids}</p></div>
      <div class="rounded-sm border bg-white p-4"><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Lots won</p><p class="mt-1 text-2xl font-black text-[#18372f]">{data.stats.wonBids || 0}</p></div>
      <div class="rounded-sm border bg-white p-4"><p class="text-xs font-bold uppercase tracking-wide text-slate-400">Won value</p><p class="mt-1 text-2xl font-black text-[#18372f]">{money(data.stats.wonValue || 0)}</p></div>
    </section>

    <section id="won-lots" class="rounded-sm border border-[#ddd6ca] bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-[#a95739]">Buyer results</p>
          <h2 class="mt-1 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold text-[#1a2821]">Lots you won</h2>
          <p class="mt-1 text-sm text-[#435048]">Hammered lots where you were the high bidder.</p>
        </div>
      </div>

      {#if data.wonLots?.length}
        <div class="mt-5 divide-y divide-[#e2dcd1]">
          {#each data.wonLots as lot}
            <a href={`/lots/${lot.id}`} class="grid gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
              <div class="h-[72px] overflow-hidden border border-[#ddd6ca] bg-[#efe8dc]">
                {#if lot.imageUrl}<img src={lot.imageUrl} alt={lot.title} class="h-full w-full object-cover" />{:else}<span class="grid h-full place-items-center text-slate-400">◇</span>{/if}
              </div>
              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Lot #{lot.lotNumber} · {lot.auction.auctionHouseName || 'Auction'} · {lot.auction.title}
                </p>
                <p class="mt-1 truncate font-bold text-[#1a2821]">{lot.title}</p>
                <p class="mt-1 text-sm text-[#435048]">Won for <strong class="text-[#1a2821]">{money(lot.currentBid)}</strong></p>
              </div>
              <div class="text-left sm:text-right">
                <span class="inline-flex bg-[#e8eee9] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#18372f]">Won</span>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <div class="mt-5 border border-dashed border-[#ddd6ca] px-5 py-10 text-center">
          <p class="font-bold text-[#1a2821]">No won lots yet</p>
          <p class="mt-1 text-sm text-[#435048]">When you win a lot, it will appear here after the auctioneer hammers it down.</p>
        </div>
      {/if}

      {#if data.leadingLots?.length}
        <div class="mt-8 border-t border-[#e2dcd1] pt-6">
          <h3 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold text-[#1a2821]">Currently leading</h3>
          <p class="mt-1 text-sm text-[#435048]">Active lots where you are the high bidder.</p>
          <div class="mt-4 divide-y divide-[#e2dcd1]">
            {#each data.leadingLots as lot}
              <a href={`/lots/${lot.id}`} class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div class="min-w-0">
                  <p class="truncate font-semibold text-[#1a2821]">{lot.title}</p>
                  <p class="text-xs text-slate-500">Lot #{lot.lotNumber} · {lot.auction.title}</p>
                </div>
                <p class="font-bold text-[#18372f]">{money(lot.currentBid)}</p>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <section class="rounded-sm border bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><h2 class="text-lg font-black">Recent bidding</h2><a href="/" class="text-sm font-semibold text-[#18372f]">Find lots</a></div>{#if data.recentBids.length}<div class="mt-4 divide-y">{#each data.recentBids as bid}<a href={`/lots/${bid.lot.id}`} class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div class="min-w-0"><p class="truncate font-semibold text-slate-900">{bid.lot.title}</p><p class="text-xs text-slate-500">Lot #{bid.lot.lotNumber}</p></div><div class="text-right"><p class="font-bold">{money(bid.amount)}</p><p class="text-xs {bid.lot.highestBidderId === data.user.id ? (bid.lot.status === 'SOLD' ? 'text-[#18372f]' : 'text-[#18372f]') : 'text-slate-400'}">{bid.lot.highestBidderId === data.user.id ? (bid.lot.status === 'SOLD' ? 'Won' : 'Leading') : 'Outbid'}</p></div></a>{/each}</div>{:else}<p class="mt-4 text-sm text-slate-500">You haven’t placed any bids yet.</p>{/if}</section>
      <aside class="rounded-sm bg-[#152c26] p-5 text-white shadow-sm"><p class="text-xs font-bold uppercase tracking-wider text-[#d6b477]">Selling with Pumbi</p><h2 class="mt-2 text-xl font-black">Submit a lot to a public auction</h2><p class="mt-2 text-sm leading-6 text-[#bec9c4]">Manage drafts, submissions, and review status in one place.</p><a href="/dashboard/sell" class="mt-5 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#152c26]">Manage submissions</a></aside>
    </div>
  </div>
</main>
