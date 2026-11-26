<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import AdminRecordEditor from '$lib/components/admin/AdminRecordEditor.svelte';
  let { data } = $props();
  let editor = $state(null);
  let notice = $state('');
  let filters = $derived(data.model.fields.filter(field => field.values || field.type === 'Boolean'));
  let filterField = $state('');

  $effect(() => { filterField = data.filter; });
  $effect(() => {
    data.model.key;
    const record = $page.url.searchParams.get('record');
    const create = $page.url.searchParams.has('create');
    editor = record ? { id: record } : create ? { id: null } : null;
    notice = '';
  });
  const display = value => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  function query(patch) {
    const params = new URLSearchParams($page.url.searchParams);
    params.delete('record'); params.delete('create');
    for (const [key, value] of Object.entries(patch)) value == null || value === '' ? params.delete(key) : params.set(key, String(value));
    return `/admin/data/${data.model.key}?${params}`;
  }
  async function close() {
    editor = null;
    if ($page.url.searchParams.has('record') || $page.url.searchParams.has('create')) await goto(query({}), { replaceState: true, noScroll: true });
  }
  async function saved(result) {
    await close();
    await invalidateAll();
    notice = result.deleted ? ui("Record deleted.") : ui("Record saved · {value0}", { value0: result.record.id });
  }
  function sort(field) { goto(query({ sort: field, order: data.sort === field && data.order === 'asc' ? 'desc' : 'asc', page: 1 }), { noScroll: true }); }
</script>

<svelte:head><title>{ui(data.model.label)} {ui("· Data manager | Pumbi Admin")}</title></svelte:head>
<div class="mx-auto max-w-7xl space-y-5">
  <a href="/admin/data" class="text-sm font-semibold text-indigo-600">{ui("← All collections")}</a>
  <header class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-wide text-indigo-600">{ui("Data manager")}</p><h1 class="mt-1 text-3xl font-black">{ui(data.model.label)}</h1><p class="mt-2 text-sm text-slate-500">{data.total.toLocaleString(uiLocale())} {ui("matching records ·")} {data.model.fields.length} {ui("fields")}</p></div><div class="flex flex-wrap gap-2"><select aria-label={ui("Switch data collection")} class="max-w-60 rounded-lg border-slate-300 text-sm" value={data.model.key} onchange={event => goto(`/admin/data/${event.currentTarget.value}`)}>{#each data.collections as collection}<option value={collection.key}>{ui(collection.label)}</option>{/each}</select><button type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onclick={() => editor = { id: null }}>{ui("Create record")}</button></div></header>
  {#if notice}<p role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ui(notice)}</p>{/if}
  <form class="flex flex-wrap gap-3 rounded-xl border bg-white p-4" onsubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); goto(query({ q: form.get('q'), filter: form.get('filter'), value: form.get('value'), page: 1 }), { noScroll: true }); }}>
    <input type="search" name="q" value={data.q} aria-label={ui("Search records")} placeholder={ui("Search IDs, names, emails, and text…")} class="min-w-48 flex-1 rounded-lg border-slate-300 text-sm" />
    <select name="filter" bind:value={filterField} class="rounded-lg border-slate-300 text-sm" aria-label={ui("Filter field")}><option value="">{ui("No field filter")}</option>{#each filters as field}<option value={field.name}>{ui(field.label)}</option>{/each}</select>
    {#if filterField}<select name="value" value={data.filter === filterField && data.value ? data.value : data.model.fields.find(field => field.name === filterField)?.values?.[0] || 'true'} class="rounded-lg border-slate-300 text-sm" aria-label={ui("Filter value")}>{#each data.model.fields.find(field => field.name === filterField)?.values || ['true', 'false'] as value}<option {value}>{ui(String(value).replaceAll('_', ' '))}</option>{/each}</select>{/if}
    <button class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{ui("Apply")}</button><a href={`/admin/data/${data.model.key}`} class="px-2 py-2 text-sm text-slate-500">{ui("Reset")}</a>
    {#if data.referenceField}<input type="hidden" name="referenceField" value={data.referenceField} /><p class="w-full break-all text-xs text-indigo-700">{ui("Related records:")} {data.referenceField} = {data.referenceId}</p>{/if}
  </form>
  <section class="overflow-hidden rounded-xl border bg-white shadow-sm">
    <div class="overflow-x-auto"><table class="w-full min-w-[760px] text-start text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr>{#each data.model.columns as column}<th class="px-4 py-3"><button type="button" class="whitespace-nowrap font-semibold" onclick={() => sort(column)}>{ui(data.model.fields.find(field => field.name === column)?.label || column)}{data.sort === column ? data.order === 'asc' ? ' ↑' : ' ↓' : ''}</button></th>{/each}<th class="px-4 py-3">{ui("Actions")}</th></tr></thead><tbody class="divide-y divide-slate-100">
      {#each data.rows as record}<tr class="hover:bg-slate-50">{#each data.model.columns as column}<td class="max-w-60 px-4 py-3"><span class="block truncate" title={display(record[column])}>{display(record[column])}</span></td>{/each}<td class="whitespace-nowrap px-4 py-3"><button type="button" class="font-semibold text-indigo-700" onclick={() => editor = { id: record.id }}>{ui("View / edit")}</button></td></tr>{/each}
      {#if !data.rows.length}<tr><td colspan={data.model.columns.length + 1} class="p-12 text-center text-slate-500">{ui("No records match these filters.")}</td></tr>{/if}
    </tbody></table></div>
    <footer class="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm"><span class="text-slate-500">{ui("Page")} {data.page} {ui("of")} {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><div class="flex gap-2">{#if data.page > 1}<a href={query({ page: data.page - 1 })} class="rounded-lg border px-3 py-2">{ui("Previous")}</a>{/if}{#if data.page * data.pageSize < data.total}<a href={query({ page: data.page + 1 })} class="rounded-lg border px-3 py-2">{ui("Next")}</a>{/if}</div></footer>
  </section>
  <p class="text-xs text-slate-500">{ui("Edits validate field types, unique values, and database relationships. Secret values are write-only. Deletions follow the collection’s database cascade rules.")}</p>
</div>

{#if editor}
  {#key `${data.model.key}:${editor.id || 'new'}`}
    <AdminRecordEditor model={data.model} recordId={editor.id} onclose={close} onsaved={saved} />
  {/key}
{/if}
