<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  const PAGE_SIZE = 20;
  const blank = (lotNumber) => ({ lotNumber, title: '', description: '', category: '', startingBid: '', bidIncrement: '100', endTime: '', status: 'ACTIVE' });
  let auction = $state(null);
  let rows = $state([]);
  let pageNumber = $state(0);
  let loading = $state(true);
  let saving = $state(false);
  let message = $state('');
  let errorMessage = $state('');
  let fileName = $state('');
  let visibleRows = $derived(rows.slice(pageNumber * PAGE_SIZE, (pageNumber + 1) * PAGE_SIZE));
  let pageCount = $derived(Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));

  onMount(async () => {
    const response = await fetch(`/api/auctions/${$page.params.id}`);
    if (response.ok) auction = await response.json();
    rows = [blank(1)];
    loading = false;
  });

  function parseCsv(text) {
    const result = [];
    let row = [], cell = '', quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; continue; }
      if (character === '"') { quoted = !quoted; continue; }
      if (character === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
      if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        row.push(cell.trim()); cell = '';
        if (row.some(Boolean)) result.push(row);
        row = [];
        continue;
      }
      cell += character;
    }
    row.push(cell.trim());
    if (row.some(Boolean)) result.push(row);
    if (result.length < 2) return [];
    const headers = result[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const find = (names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
    const index = {
      lotNumber: find(['lotnumber', 'lotno', 'lot']), title: find(['title', 'name']), description: find(['description', 'details']),
      category: find(['category', 'group']), startingBid: find(['startingbid', 'startprice', 'openingprice']),
      bidIncrement: find(['bidincrement', 'increment', 'step']), endTime: find(['endtime', 'closing', 'enddate']), status: find(['status', 'state'])
    };
    return result.slice(1).map((values, rowIndex) => {
      const value = (field) => index[field] >= 0 ? values[index[field]] || '' : '';
      return { ...blank(Number(value('lotNumber')) || rowIndex + 1), title: value('title'), description: value('description'), category: value('category'), startingBid: value('startingBid'), bidIncrement: value('bidIncrement') || '100', endTime: value('endTime'), status: (value('status') || 'ACTIVE').toUpperCase() };
    });
  }

  async function importCsv(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    fileName = file.name;
    errorMessage = '';
    try {
      const imported = parseCsv(await file.text());
      if (!imported.length) throw new Error(ui("The CSV needs a header row and at least one lot row."));
      rows = imported;
      pageNumber = 0;
      message = ui("{value0} rows loaded. Review them before saving.", { value0: imported.length });
    } catch (error) { errorMessage = error.message; }
  }

  function addRow() {
    rows = [...rows, blank(rows.length + 1)];
    pageNumber = Math.floor((rows.length - 1) / PAGE_SIZE);
  }

  function removeRow(index) {
    rows = rows.filter((_, rowIndex) => rowIndex !== index);
    if (pageNumber >= pageCount) pageNumber = Math.max(0, pageCount - 1);
  }

  function updateCell(index, field, value) {
    rows[index] = { ...rows[index], [field]: value };
  }

  async function saveRows() {
    saving = true; message = ''; errorMessage = '';
    try {
      const response = await fetch(`/api/auctions/${$page.params.id}/lots/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || ui("Could not save lots"));
      message = ui("Saved {value0} new lots and updated {value1} existing lots.", { value0: result.created, value1: result.updated });
      if (result.errors?.length) errorMessage = result.errors.map((item) => `Row ${item.row}: ${item.message}`).join(' · ');
    } catch (error) { errorMessage = error.message; } finally { saving = false; }
  }
</script>

<svelte:head><title>{ui("Bulk lots ·")} {auction?.title || ui("Auction")}</title></svelte:head>

<main>
  <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="pumbi-eyebrow">{ui("Mass upload")}</p>
      <h2 class="mt-1 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">{ui("Bulk lot editor")}</h2>
      <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">{ui("Paste or upload catalog data. The grid shows up to 20 rows at a time.")}</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <label class="pumbi-btn-secondary cursor-pointer"><input type="file" accept=".csv,text/csv" class="sr-only" onchange={importCsv} />{ui("Upload CSV")}</label>
      <button type="button" onclick={addRow} class="pumbi-btn-secondary">{ui("+ Add row")}</button>
      <button type="button" onclick={saveRows} disabled={saving || loading} class="pumbi-btn disabled:opacity-50">{saving ? ui("Saving…") : ui("Save lots")}</button>
    </div>
  </header>

  {#if fileName}<p class="mb-3 text-xs text-[var(--pumbi-muted)]">{ui("Loaded:")} {fileName}</p>{/if}
  {#if message}<div class="mb-3 border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{ui(message)}</div>{/if}
  {#if errorMessage}<div class="mb-3 border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{ui(errorMessage)}</div>{/if}

  <section class="pumbi-panel overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--pumbi-line)] bg-[var(--pumbi-cream-deep)] px-4 py-3">
      <div>
        <p class="font-semibold">{auction?.title || ui("Loading auction…")}</p>
        <p class="text-xs text-[var(--pumbi-muted)]">{rows.length} {ui("total rows · CSV columns: lotNumber, title, description, category, startingBid, bidIncrement, endTime, status")}</p>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <button type="button" onclick={() => pageNumber = Math.max(0, pageNumber - 1)} disabled={pageNumber === 0} class="border border-[var(--pumbi-line)] px-3 py-1.5 font-bold disabled:opacity-40">←</button>
        <span class="font-semibold text-[var(--pumbi-ink-soft)]">{ui("Page")} {pageNumber + 1} {ui("of")} {pageCount}</span>
        <button type="button" onclick={() => pageNumber = Math.min(pageCount - 1, pageNumber + 1)} disabled={pageNumber >= pageCount - 1} class="border border-[var(--pumbi-line)] px-3 py-1.5 font-bold disabled:opacity-40">→</button>
      </div>
    </div>
    <div class="overflow-x-auto"><table class="min-w-[1050px] w-full border-collapse text-sm"><thead><tr class="bg-[var(--pumbi-cream-deep)] text-start text-[11px] font-bold uppercase tracking-wide text-[var(--pumbi-muted)]"><th class="w-12 border-b border-[var(--pumbi-line)] px-3 py-3">#</th><th class="w-24 border-b border-[var(--pumbi-line)] px-2 py-3">{ui("Lot no.")}</th><th class="min-w-56 border-b border-[var(--pumbi-line)] px-2 py-3">{ui("Title *")}</th><th class="min-w-64 border-b border-[var(--pumbi-line)] px-2 py-3">{ui("Description")}</th><th class="w-36 border-b border-[var(--pumbi-line)] px-2 py-3">{ui("Category")}</th><th class="w-32 border-b border-[var(--pumbi-line)] px-2 py-3">{ui("Starting bid")}</th><th class="w-32 border-b border-[var(--pumbi-line)] px-2 py-3">{ui("Increment")}</th><th class="w-48 border-b border-[var(--pumbi-line)] px-2 py-3">{ui("End time")}</th><th class="w-32 border-b border-[var(--pumbi-line)] px-2 py-3">{ui("Status")}</th><th class="w-12 border-b border-[var(--pumbi-line)] px-2 py-3"></th></tr></thead><tbody>{#each visibleRows as row, visibleIndex (pageNumber * PAGE_SIZE + visibleIndex)}{@const rowIndex = pageNumber * PAGE_SIZE + visibleIndex}<tr class="hover:bg-[var(--pumbi-cream-deep)]/60"><td class="border-b border-[var(--pumbi-line-soft)] px-3 py-2 text-xs font-bold text-[var(--pumbi-muted)]">{rowIndex + 1}</td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1"><input type="number" min="1" class="w-full border border-[var(--pumbi-line)] text-sm" value={row.lotNumber} onchange={(event) => updateCell(rowIndex, 'lotNumber', event.currentTarget.value)} /></td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1"><input class="w-full border border-[var(--pumbi-line)] text-sm" value={row.title} onchange={(event) => updateCell(rowIndex, 'title', event.currentTarget.value)} /></td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1"><input class="w-full border border-[var(--pumbi-line)] text-sm" value={row.description} onchange={(event) => updateCell(rowIndex, 'description', event.currentTarget.value)} /></td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1"><input class="w-full border border-[var(--pumbi-line)] text-sm" value={row.category} onchange={(event) => updateCell(rowIndex, 'category', event.currentTarget.value)} /></td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1"><input type="number" min="0" step="0.01" class="w-full border border-[var(--pumbi-line)] text-sm" value={row.startingBid} onchange={(event) => updateCell(rowIndex, 'startingBid', event.currentTarget.value)} /></td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1"><input type="number" min="0" step="0.01" class="w-full border border-[var(--pumbi-line)] text-sm" value={row.bidIncrement} onchange={(event) => updateCell(rowIndex, 'bidIncrement', event.currentTarget.value)} /></td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1"><input type="datetime-local" class="w-full border border-[var(--pumbi-line)] text-sm" value={row.endTime} onchange={(event) => updateCell(rowIndex, 'endTime', event.currentTarget.value)} /></td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1"><select class="w-full border border-[var(--pumbi-line)] text-sm" value={row.status} onchange={(event) => updateCell(rowIndex, 'status', event.currentTarget.value)}><option>{ui("ACTIVE")}</option><option>{ui("SOLD")}</option><option>{ui("UNSOLD")}</option><option>{ui("WITHDRAWN")}</option></select></td><td class="border-b border-[var(--pumbi-line-soft)] px-2 py-1 text-center"><button type="button" aria-label={ui("Remove row")} onclick={() => removeRow(rowIndex)} class="text-[var(--pumbi-muted)] hover:text-red-700">×</button></td></tr>{/each}</tbody></table></div>
  </section>
</main>
