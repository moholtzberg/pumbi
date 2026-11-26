<script>
  import { page as currentPage } from '$app/stores';
  import { localeTag } from '$lib/utils/region.js';
  import { publicHousePath } from '$lib/utils/houseSlugs.js';
  let { data } = $props();
  const text = (en, he) => ($currentPage.data.locale === 'he' ? he : en);
  const date = (value) =>
    new Date(value).toLocaleString(localeTag($currentPage.data.locale), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  const link = (filter, page = 1) =>
    `${publicHousePath(data.house.slug)}?${new URLSearchParams({ status: filter, page: String(page) })}`;
</script>

<svelte:head>
  <title>{data.house.name} | Pumbi</title><meta
    name="description"
    content={data.house.description || `${data.house.name} auctions on Pumbi`}
  /><link rel="canonical" href={data.canonical} />
</svelte:head>
<main class="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
  <a href="/" class="pumbi-link text-sm">
    {text('← All auctions', '→ כל המכירות')}
  </a>
  <section
    class="pumbi-panel mt-5 grid gap-7 p-6 md:grid-cols-[minmax(0,1fr)_300px] sm:p-8"
  >
    <div>
      <div class="flex items-center gap-4">
        {#if data.house.logoUrl}<img
            src={data.house.logoUrl}
            alt={data.house.name}
            class="h-20 w-20 shrink-0 border border-[var(--pumbi-line)] bg-white object-contain p-2"
          />{/if}
        <div>
          <p class="pumbi-eyebrow">{text('Auction house', 'בית מכירות')}</p>
          <h1
            class="mt-2 font-[family-name:var(--pumbi-serif)] text-4xl font-semibold"
            dir="auto"
          >
            {data.house.name}
          </h1>
        </div>
      </div>
      {#if data.house.description}<p
          class="mt-5 whitespace-pre-line text-sm leading-7 text-[var(--pumbi-ink-soft)]"
          dir="auto"
        >
          {data.house.description}
        </p>{/if}
    </div>
    <address
      class="space-y-3 border-t border-[var(--pumbi-line)] pt-5 text-sm not-italic md:border-t-0 md:border-s md:ps-6 md:pt-0"
    >
      <h2 class="font-semibold">{text('Contact the house', 'יצירת קשר')}</h2>
      {#if data.house.address}<p
          class="whitespace-pre-line leading-6"
          dir="auto"
        >
          {data.house.address}
        </p>{/if}{#if data.house.email}<p class="break-all" dir="ltr">
          {data.house.email}
        </p>{/if}{#if data.house.phone}<p dir="ltr">
          {data.house.phone}
        </p>{/if}{#if data.house.website}<a
          href={data.house.website}
          target="_blank"
          rel="noreferrer"
          class="pumbi-link inline-block"
        >
          {text('Visit website ↗', 'אתר בית המכירות ↗')}
        </a>{/if}
    </address>
  </section>
  <section class="mt-10">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h2 class="font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">
        {text('Auctions', 'מכירות פומביות')}
      </h2>
      <nav
        aria-label={text('Filter house auctions', 'סינון מכירות בית המכירות')}
        class="flex flex-wrap gap-2"
      >
        {#each [['current', 'Current auctions', 'מכירות נוכחיות'], ['past', 'Past auctions', 'מכירות שהסתיימו'], ['all', 'All auctions', 'כל המכירות']] as [value, en, he]}<a
            href={link(value)}
            aria-current={data.filter === value ? 'page' : undefined}
            class="border px-4 py-2 text-sm font-semibold {data.filter === value
              ? 'border-[#18372f] bg-[#18372f] text-white'
              : 'border-[var(--pumbi-line)] bg-white'}"
          >
            {text(en, he)}
          </a>{/each}
      </nav>
    </div>
    {#if data.auctions.length}<div
        class="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {#each data.auctions as auction}<article
            class="pumbi-panel overflow-hidden"
          >
            <a href={`/auctions/${auction.id}`} class="group block h-full">
              <div
                class="relative h-48 border-b border-[var(--pumbi-line)] bg-[var(--pumbi-cream-deep)]"
              >
                {#if auction.imageUrl}<img
                    src={auction.imageUrl}
                    alt={auction.title}
                    class="h-full w-full object-cover"
                  />{:else}<span
                    class="grid h-full place-items-center font-[family-name:var(--pumbi-serif)] text-6xl italic text-[#18372f]/25"
                    aria-hidden="true"
                  >
                    P
                  </span>{/if}<span
                  class="absolute end-3 top-3 border border-[var(--pumbi-line)] bg-white px-3 py-1 text-xs font-bold"
                >
                  {auction.status === 'LIVE'
                    ? text('Live now', 'בשידור חי')
                    : auction.status === 'ENDED'
                      ? text('Ended', 'הסתיימה')
                      : text('Upcoming', 'בקרוב')}
                </span>
              </div>
              <div class="p-5">
                <h3
                  class="font-[family-name:var(--pumbi-serif)] text-2xl font-semibold group-hover:text-[var(--pumbi-terracotta)]"
                  dir="auto"
                >
                  {auction.title}
                </h3>
                {#if auction.description}<p
                    class="mt-2 line-clamp-2 text-sm text-[var(--pumbi-ink-soft)]"
                    dir="auto"
                  >
                    {auction.description}
                  </p>{/if}
                <p class="mt-5 text-xs text-[var(--pumbi-ink-soft)]">
                  {date(auction.startDate)}
                </p>
                <div
                  class="mt-3 flex items-center justify-between border-t border-[var(--pumbi-line)] pt-3 text-sm"
                >
                  <span>
                    {auction.lotCount}
                    {text('lots', 'פריטים')} · {(
                      auction.currency || 'usd'
                    ).toUpperCase()}
                  </span><span class="font-semibold text-[#18372f]">
                    {text('View catalog →', 'לקטלוג ←')}
                  </span>
                </div>
              </div>
            </a>
          </article>{/each}
      </div>{:else}<div
        class="pumbi-panel mt-6 p-12 text-center text-sm text-[var(--pumbi-ink-soft)]"
      >
        {data.filter === 'past'
          ? text('No past auctions yet.', 'עדיין אין מכירות שהסתיימו.')
          : text(
              'No auctions to show here yet. Check back for the next sale.',
              'אין כרגע מכירות להצגה. כדאי לחזור בהמשך.',
            )}
      </div>{/if}
    {#if data.pages > 1}<nav
        class="mt-6 flex items-center justify-between gap-3 text-sm"
        aria-label={text('Auction pagination', 'עמודי מכירות')}
      >
        {#if data.page > 1}<a
            class="pumbi-btn-secondary"
            href={link(data.filter, data.page - 1)}
          >
            {text('← Previous', '→ הקודם')}
          </a>{:else}<span></span>{/if}<span>
          {data.page} / {data.pages}
        </span>{#if data.page < data.pages}<a
            class="pumbi-btn-secondary"
            href={link(data.filter, data.page + 1)}
          >
            {text('Next →', 'הבא ←')}
          </a>{:else}<span></span>{/if}
      </nav>{/if}
  </section>
</main>
