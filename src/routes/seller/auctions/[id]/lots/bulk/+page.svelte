<script>
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
      if (!imported.length) throw new Error('The CSV needs a header row and at least one lot row.');
      rows = imported;
      pageNumber = 0;
      message = `${imported.length} rows loaded. Review them before saving.`;
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
      if (!response.ok) throw new Error(result.message || result.error || 'Could not save lots');
      message = `Saved ${result.created} new lots and updated ${result.updated} existing lots.`;
      if (result.errors?.length) errorMessage = result.errors.map((item) => `Row ${item.row}: ${item.message}`).join(' · ');
    } catch (error) { errorMessage = error.message; } finally { saving = false; }
  }
</script>

<svelte:head><title>Bulk lots · {auction?.title || 'Auction'}</title></svelte:head>

<main class="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-[1600px]">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><a href={`/seller/auctions/${$page.params.id}/lots`} class="text-sm font-bold text-violet-700">← Back to lots</a><p class="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Mass upload</p><h1 class="mt-1 text-3xl font-black text-slate-950">Bulk lot editor</h1><p class="mt-1 text-sm text-slate-500">Paste or upload catalog data. The grid shows up to 20 rows at a time.</p></div>
      <div class="flex flex-wrap gap-2"><label class="cursor-pointer rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 shadow-sm hover:bg-violet-50"><input type="file" accept=".csv,text/csv" class="sr-only" onchange={importCsv} />Upload CSV</label><button type="button" onclick={addRow} class="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">+ Add row</button><button type="button" onclick={saveRows} disabled={saving || loading} class="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save lots'}</button></div>
    </header>

    {#if fileName}<p class="mt-4 text-xs text-slate-500">Loaded: {fileName}</p>{/if}
    {#if message}<div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</div>{/if}
    {#if errorMessage}<div class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{errorMessage}</div>{/if}

    <section class="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3"><div><p class="font-bold text-slate-900">{auction?.title || 'Loading auction…'}</p><p class="text-xs text-slate-500">{rows.length} total rows · CSV columns: lotNumber, title, description, category, startingBid, bidIncrement, endTime, status</p></div><div class="flex items-center gap-2 text-sm"><button type="button" onclick={() => pageNumber = Math.max(0, pageNumber - 1)} disabled={pageNumber === 0} class="rounded-lg border px-3 py-1.5 font-bold disabled:opacity-40">←</button><span class="font-semibold text-slate-600">Page {pageNumber + 1} of {pageCount}</span><button type="button" onclick={() => pageNumber = Math.min(pageCount - 1, pageNumber + 1)} disabled={pageNumber >= pageCount - 1} class="rounded-lg border px-3 py-1.5 font-bold disabled:opacity-40">→</button></div></div>
      <div class="overflow-x-auto"><table class="min-w-[1050px] w-full border-collapse text-sm"><thead><tr class="bg-slate-100 text-left text-[11px] font-black uppercase tracking-wide text-slate-500"><th class="w-12 border-b px-3 py-3">#</th><th class="w-24 border-b px-2 py-3">Lot no.</th><th class="min-w-56 border-b px-2 py-3">Title *</th><th class="min-w-64 border-b px-2 py-3">Description</th><th class="w-36 border-b px-2 py-3">Category</th><th class="w-32 border-b px-2 py-3">Starting bid</th><th class="w-32 border-b px-2 py-3">Increment</th><th class="w-48 border-b px-2 py-3">End time</th><th class="w-32 border-b px-2 py-3">Status</th><th class="w-12 border-b px-2 py-3"></th></tr></thead><tbody>{#each visibleRows as row, visibleIndex (pageNumber * PAGE_SIZE + visibleIndex)}{@const rowIndex = pageNumber * PAGE_SIZE + visibleIndex}<tr class="hover:bg-violet-50/40"><td class="border-b px-3 py-2 text-xs font-bold text-slate-400">{rowIndex + 1}</td><td class="border-b px-2 py-1"><input type="number" min="1" class="w-full rounded border-slate-200 text-sm" value={row.lotNumber} onchange={(event) => updateCell(rowIndex, 'lotNumber', event.currentTarget.value)} /></td><td class="border-b px-2 py-1"><input class="w-full rounded border-slate-200 text-sm" value={row.title} onchange={(event) => updateCell(rowIndex, 'title', event.currentTarget.value)} /></td><td class="border-b px-2 py-1"><input class="w-full rounded border-slate-200 text-sm" value={row.description} onchange={(event) => updateCell(rowIndex, 'description', event.currentTarget.value)} /></td><td class="border-b px-2 py-1"><input class="w-full rounded border-slate-200 text-sm" value={row.category} onchange={(event) => updateCell(rowIndex, 'category', event.currentTarget.value)} /></td><td class="border-b px-2 py-1"><input type="number" min="0" step="0.01" class="w-full rounded border-slate-200 text-sm" value={row.startingBid} onchange={(event) => updateCell(rowIndex, 'startingBid', event.currentTarget.value)} /></td><td class="border-b px-2 py-1"><input type="number" min="0" step="0.01" class="w-full rounded border-slate-200 text-sm" value={row.bidIncrement} onchange={(event) => updateCell(rowIndex, 'bidIncrement', event.currentTarget.value)} /></td><td class="border-b px-2 py-1"><input type="datetime-local" class="w-full rounded border-slate-200 text-sm" value={row.endTime} onchange={(event) => updateCell(rowIndex, 'endTime', event.currentTarget.value)} /></td><td class="border-b px-2 py-1"><select class="w-full rounded border-slate-200 text-sm" value={row.status} onchange={(event) => updateCell(rowIndex, 'status', event.currentTarget.value)}><option>ACTIVE</option><option>SOLD</option><option>UNSOLD</option><option>WITHDRAWN</option></select></td><td class="border-b px-2 py-1 text-center"><button type="button" aria-label="Remove row" onclick={() => removeRow(rowIndex)} class="text-slate-400 hover:text-red-600">×</button></td></tr>{/each}</tbody></table></div>
    </section>
  </div>
</main>
