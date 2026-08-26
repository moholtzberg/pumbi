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

  let isPrivate = $derived(String(auction.type || 'PRIVATE').toUpperCase() === 'PRIVATE');

  let tiles = $derived([
    {
      href: `/seller/auctions/${auction.id}/control-room`,
      eyebrow: 'Live sale',
      title: 'Control room',
      body: 'Claim the auctioneer seat, open lots, and hammer the sale.',
      tone: 'dark'
    },
    {
      href: `/seller/auctions/${auction.id}/lots`,
      eyebrow: 'Catalog',
      title: 'Lots',
      body: 'Add, edit, reorder, and mark lots ready for the block.',
      tone: 'light'
    },
    {
      href: `/seller/auctions/${auction.id}/interest`,
      eyebrow: 'Analytics',
      title: 'Interest',
      body: 'Unique page views and time on page for this sale and its lots.',
      tone: 'light'
    },
    {
      href: `/seller/auctions/${auction.id}/settings`,
      eyebrow: 'Setup',
      title: 'Auction settings',
      body: 'Timing, live stream, gallery, and sale-specific rules.',
      tone: 'light'
    },
    ...(isPrivate
      ? [
          {
            href: `/seller/auctions/${auction.id}/bidders`,
            eyebrow: 'Access',
            title: 'Bidders',
            body: 'Review and approve private-auction registrations.',
            tone: 'light'
          }
        ]
      : [])
  ]);
</script>

<section class="grid gap-4 sm:grid-cols-3">
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">Lots</p>
    <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{auction.lotCount}</p>
  </div>
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">Registrations</p>
    <p class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">{auction.registrationCount}</p>
  </div>
  <div class="pumbi-panel p-5">
    <p class="pumbi-eyebrow">Window</p>
    <p class="mt-2 text-sm leading-6 text-[var(--pumbi-ink-soft)]">
      {formatDate(auction.startDate)}
      <span class="text-[var(--pumbi-muted)]"> → </span>
      {formatDate(auction.endDate)}
    </p>
  </div>
</section>

<section class="mt-6 grid gap-4 md:grid-cols-2">
  {#each tiles as tile}
    <a
      href={tile.href}
      class="group block border p-6 transition hover:-translate-y-0.5 {tile.tone === 'dark'
        ? 'border-[var(--pumbi-forest-deep)] bg-[var(--pumbi-forest-deep)] text-[#f7f4ee]'
        : 'pumbi-panel'}"
    >
      <p class="text-[10px] font-bold uppercase tracking-[0.18em] {tile.tone === 'dark' ? 'text-[#d6b477]' : 'text-[var(--pumbi-terracotta)]'}">
        {tile.eyebrow}
      </p>
      <h2 class="mt-3 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">{tile.title}</h2>
      <p class="mt-2 text-sm leading-6 {tile.tone === 'dark' ? 'text-[#bec9c4]' : 'text-[var(--pumbi-ink-soft)]'}">{tile.body}</p>
      <p class="mt-4 text-xs font-bold uppercase tracking-wide {tile.tone === 'dark' ? 'text-[#d6b477]' : 'text-[var(--pumbi-forest)]'} group-hover:underline">
        Open →
      </p>
    </a>
  {/each}
</section>

{#if auction.description}
  <section class="pumbi-panel mt-6 p-6">
    <p class="pumbi-eyebrow">Description</p>
    <p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--pumbi-ink-soft)]">{auction.description}</p>
  </section>
{/if}
