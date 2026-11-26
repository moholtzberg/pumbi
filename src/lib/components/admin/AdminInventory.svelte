<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import AdminRecordEditor from '$lib/components/admin/AdminRecordEditor.svelte';
  import { adminListUrl } from '$lib/utils/adminManagement.js';
  import { publicHousePath, houseSlugProblem } from '$lib/utils/houseSlugs.js';
  import { formatMoney } from '$lib/utils/region.js';
  let { data, kind } = $props();
  let editor = $state(null);
  let notice = $state('');
  let failure = $state('');
  const labels = {
    auctionHouse: 'Auction houses',
    auction: 'Auctions',
    lot: 'Lots',
  };
  let title = $derived(ui(labels[kind]));
  const date = (value) =>
    value
      ? new Date(value).toLocaleString(uiLocale(), {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '—';
  const label = (value) => String(value || '').replaceAll('_', ' ');
  const route = (key) =>
    key === 'auctionHouse'
      ? '/admin/auction-houses'
      : key === 'auction'
        ? '/admin/auctions'
        : '/admin/lots';
  const pageUrl = (number) =>
    adminListUrl(route(kind), $page.url.searchParams, { page: number });
  function open(row, remove = false) {
    notice = '';
    failure = '';
    editor = { id: row.id, label: row.name || row.title, remove };
  }
  function create() {
    notice = '';
    failure = '';
    editor = { id: null, label: '', remove: false };
  }
  async function saved(result) {
    await invalidateAll();
    editor = null;
    notice = result.deleted ? ui("Record removed.") : ui("Changes saved.");
  }
  let initialValues = $derived(
    kind === 'lot' && data.filters.auction
      ? { auctionId: data.filters.auction }
      : {},
  );
</script>

<svelte:head><title>{ui(title)} {ui("| Pumbi Admin")}</title></svelte:head>
<div class="mx-auto max-w-7xl space-y-5">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="text-xs font-bold uppercase tracking-widest text-indigo-600">
        {ui("Platform management")}
      </p>
      <h1 class="mt-1 text-3xl font-black">{ui(title)}</h1>
      <p class="mt-2 text-sm text-slate-500">
        {kind === 'auctionHouse'
          ? ui("Manage partner details, active status, auctions, and catalog inventory.")
          : kind === 'auction'
            ? ui("Every public and private sale across all auction houses. Edit a sale or open its lots.")
            : ui("Find catalog entries by title, lot number, auction, or auction house.")}
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      {#if kind === 'auction'}<a
          href="/admin/auction-operations?create=1"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {ui("Create public auction")}
        </a><a
          href="/admin/auction-operations"
          class="rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
        >
          {ui("Series, policies & submissions")}
        </a>{:else}<button
          type="button"
          onclick={create}
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {kind === 'auctionHouse' ? ui("Add auction house") : ui("Add lot")}
        </button>{/if}
    </div>
  </header>
  {#if data.context.house || data.context.auction}<nav
      aria-label={ui("Inventory context")}
      class="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm"
    >
      <a href={route(kind)} class="font-semibold text-indigo-700">
        {ui("All")} {title.toLowerCase()}
      </a>{#if data.context.house}<span>/</span><a
          href={`/admin/auction-houses/${data.context.house.id}`}
          class="font-semibold text-indigo-700"
        >
          {data.context.house.name}
        </a>{/if}{#if data.context.auction}<span>/</span><span>
          {data.context.auction.title}
        </span>{/if}
    </nav>{/if}
  {#if notice}<p
      role="status"
      class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
    >
      {ui(notice)}
    </p>{/if}
  {#if failure}<p
      role="alert"
      class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      {ui(failure)}
    </p>{/if}
  <form class="flex flex-wrap gap-3 rounded-xl border bg-white p-4 shadow-sm">
    {#if data.filters.house}<input
        type="hidden"
        name="house"
        value={data.filters.house}
      />{/if}{#if data.filters.auction}<input
        type="hidden"
        name="auction"
        value={data.filters.auction}
      />{/if}
    <input
      name="q"
      type="search"
      value={data.filters.q}
      aria-label={ui("Search {value0}", { value0: title.toLowerCase() })}
      placeholder={kind === 'lot'
        ? ui("Title, Hebrew title, lot number, auction or house…")
        : ui("Search name, title, house, or ID…")}
      class="min-w-[200px] flex-1 rounded-lg border-slate-300 text-sm"
    />
    <select
      name="status"
      value={data.filters.status}
      aria-label={ui("Filter status")}
      class="rounded-lg border-slate-300 text-sm"
    >
      <option value="">
        {ui("All statuses")}
      </option>{#each data.statuses as status}<option value={status}>
          {uiStatus(label(status))}
        </option>{/each}
    </select>
    {#if kind === 'auction'}<select
        name="type"
        value={data.filters.type}
        aria-label={ui("Filter auction type")}
        class="rounded-lg border-slate-300 text-sm"
      >
        <option value="">{ui("Public & private")}</option><option value="PUBLIC">
          {ui("Public")}
        </option><option value="PRIVATE">{ui("Private")}</option>
      </select>{/if}
    <select
      name="sort"
      value={data.sort}
      aria-label={ui("Sort records")}
      class="rounded-lg border-slate-300 text-sm"
    >
      <option value="newest">{ui("Newest first")}</option><option value="oldest">
        {ui("Oldest first")}
      </option><option value="name">{ui("Name / title")}</option><option value="status">
        {ui("Status")}
      </option>
    </select>
    <button
      class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
    >
      {ui("Apply filters")}
    </button><a
      href={route(kind)}
      class="px-2 py-2 text-sm font-semibold text-slate-500"
    >
      {ui("Clear")}
    </a>
  </form>
  <div
    class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"
  >
    <p>
      {data.total.toLocaleString(uiLocale())} {ui("matching")} {data.total === 1 ? (kind === 'auctionHouse' ? ui("auction house") : kind === 'auction' ? ui("auction") : ui("lot")) : title.toLowerCase()} · {data.total
        ? (data.page - 1) * data.pageSize + 1
        : 0}–{Math.min(data.page * data.pageSize, data.total)} {ui("shown")}
    </p>
    <a
      class="text-xs font-semibold text-indigo-700"
      href={`/admin/data/${kind}`}
    >
      {ui("Advanced data manager →")}
    </a>
  </div>
  <section class="overflow-hidden rounded-xl border bg-white shadow-sm">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[850px] text-start text-sm">
        <thead
          class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"
        >
          <tr>
            <th class="px-5 py-3">
              {kind === 'auctionHouse'
                ? ui("Auction house")
                : kind === 'auction'
                  ? ui("Auction")
                  : ui("Lot")}
            </th><th class="px-5 py-3">
              {kind === 'auctionHouse'
                ? ui("Contact")
                : kind === 'auction'
                  ? ui("House")
                  : ui("Auction / house")}
            </th><th class="px-5 py-3">{ui("Status")}</th><th class="px-5 py-3">
              {kind === 'lot' ? ui("Pricing") : ui("Activity")}
            </th><th class="px-5 py-3 text-end">{ui("Actions")}</th>
          </tr>
        </thead><tbody class="divide-y divide-slate-100">
          {#each data.rows as row (row.id)}<tr class="hover:bg-slate-50">
              <td class="px-5 py-4">
                <button
                  type="button"
                  onclick={() => open(row)}
                  class="text-start font-bold text-slate-950 hover:text-indigo-700"
                  aria-label={ui("Edit {value0}", { value0: row.name || row.title })}
                >
                  {kind === 'lot' ? `#${row.lotNumber} · ` : ''}{row.name ||
                    row.title}
                </button>{#if kind === 'auctionHouse'}<p
                    class="mt-1 text-xs text-slate-500"
                  >
                    {row.legalName || row.slug}{row.country
                      ? ` · ${row.country}`
                      : ''}
                  </p>{:else if kind === 'auction'}<p
                    class="mt-1 text-xs text-slate-500"
                  >
                    {ui(row.type)} · {(row.currency || 'usd').toUpperCase()} · {date(
                      row.startDate,
                    )}
                  </p>{:else}<p class="mt-1 text-xs text-slate-500" dir="auto">
                    {row.hebrewTitle ||
                      (row.isReady
                        ? ui("Ready for marketplace")
                        : ui("Needs catalog review"))}
                  </p>{/if}
              </td>
              <td class="px-5 py-4">
                {#if kind === 'auctionHouse'}<p>{row.contactEmail || '—'}</p>
                  <a
                    class="mt-1 block text-xs font-semibold text-indigo-600"
                    href={`/admin/auction-houses/${row.id}`}
                  >
                    {ui("Team & partner profile →")}
                  </a>{#if row.isActive && row.onboardingStatus === 'APPROVED' && !houseSlugProblem(row.slug)}<a class="mt-2 block text-xs font-semibold text-indigo-600" href={publicHousePath(row.slug)} target="_blank" rel="noreferrer">{ui("Public page ↗")}</a>{:else}<span class="mt-2 block text-xs text-slate-400">{ui("Public page not published")}</span>{/if}{:else if kind === 'auction'}<a
                    class="font-semibold text-indigo-600"
                    href={`/admin/auction-houses/${row.auctionHouse.id}`}
                  >
                    {row.auctionHouse.name}
                  </a>{:else}<a
                    class="font-semibold text-indigo-600"
                    href={`/admin/auctions?q=${encodeURIComponent(row.auction.id)}`}
                  >
                    {row.auction.title}
                  </a>
                  <p class="mt-1 text-xs text-slate-500">
                    <a
                      href={`/admin/auction-houses/${row.auction.auctionHouse.id}`}
                    >
                      {row.auction.auctionHouse.name}
                    </a>
                  </p>{/if}
              </td>
              <td class="px-5 py-4">
                <span
                  class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold"
                >
                  {uiStatus(label(
                    kind === 'auctionHouse' ? row.onboardingStatus : row.status,
                  ))}
                </span>{#if kind === 'auctionHouse' && !row.isActive}<p
                    class="mt-2 text-xs font-semibold text-red-700"
                  >
                    {ui("Inactive")}
                  </p>{/if}
              </td>
              <td class="px-5 py-4">
                {#if kind === 'auctionHouse'}<a
                    href={`/admin/auctions?house=${encodeURIComponent(row.id)}`}
                    class="block font-semibold text-indigo-600"
                  >
                    {row._count.auctions} {ui("auctions →")}
                  </a><a
                    href={`/admin/lots?house=${encodeURIComponent(row.id)}`}
                    class="mt-1 block text-xs font-semibold text-indigo-600"
                  >
                    {ui("Browse house lots →")}
                  </a>{:else if kind === 'auction'}<a
                    href={`/admin/lots?auction=${encodeURIComponent(row.id)}`}
                    class="block font-semibold text-indigo-600"
                  >
                    {row._count.lots} {ui("lots →")}
                  </a>
                  <p class="mt-1 text-xs text-slate-500">
                    {row._count.registrations} {ui("registered bidders")}
                  </p>{:else}<p class="font-semibold">
                    {formatMoney(row.currentBid, row.auction.currency || 'usd', $localePage.data.locale)}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">
                    {ui("Starts")} {formatMoney(
                      row.startingBid,
                      row.auction.currency || 'usd',
                      $localePage.data.locale,
                    )} · {row._count.bids} {ui("bids")}
                  </p>{/if}
              </td>
              <td class="px-5 py-4">
                <div class="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onclick={() => open(row)}
                    class="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700"
                    aria-label={ui("Edit record {value0}", { value0: row.id })}
                  >
                    {ui("Edit")}
                  </button><button
                    type="button"
                    onclick={() => open(row, true)}
                    class="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                    aria-label={ui("Remove {value0}", { value0: row.name || row.title })}
                  >
                    {ui("Remove")}
                  </button>{#if kind !== 'auctionHouse'}<a
                      class="px-2 py-2 text-xs font-semibold text-slate-500"
                      href={kind === 'lot'
                        ? `/lots/${row.id}`
                        : `/auctions/${row.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ui("View ↗")}
                    </a>{/if}
                </div>
              </td>
            </tr>{/each}
          {#if !data.rows.length}<tr>
              <td colspan="5" class="p-12 text-center text-slate-500">
                {ui("No")} {title.toLowerCase()} {ui("match these filters.")}
                <a href={route(kind)} class="font-semibold text-indigo-600">
                  {ui("Clear filters")}
                </a>
              </td>
            </tr>{/if}
        </tbody>
      </table>
    </div>
  </section>
  <nav
    class="flex items-center justify-between gap-3 text-sm"
    aria-label={ui("Inventory pagination")}
  >
    {#if data.page > 1}<a
        class="rounded-lg border bg-white px-4 py-2 font-semibold"
        href={pageUrl(data.page - 1)}
      >
        {ui("← Previous")}
      </a>{:else}<span class="px-4 py-2 text-slate-400">
        {ui("← Previous")}
      </span>{/if}<span>
      {ui("Page")} {data.page} {ui("of")} {data.pages}
    </span>{#if data.page < data.pages}<a
        class="rounded-lg border bg-white px-4 py-2 font-semibold"
        href={pageUrl(data.page + 1)}
      >
        {ui("Next →")}
      </a>{:else}<span class="px-4 py-2 text-slate-400">{ui("Next →")}</span>{/if}
  </nav>
</div>
{#if editor}{#key `${kind}:${editor.id || 'new'}:${editor.remove}`}<AdminRecordEditor
      model={data.model}
      recordId={editor.id}
      recordLabel={editor.label}
      simple
      initialDelete={editor.remove}
      {initialValues}
      onclose={() => (editor = null)}
      onsaved={saved}
    />{/key}{/if}
