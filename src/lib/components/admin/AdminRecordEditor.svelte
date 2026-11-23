<script>
  import { onMount } from 'svelte';
  let { model, recordId = null, onclose, onsaved } = $props();
  let dialog = $state(null);
  let loading = $state(Boolean(recordId));
  let saving = $state(false);
  let errorMessage = $state('');
  let draft = $state({});
  let original = $state({});
  let secretsSet = $state({});
  let related = $state([]);
  let dirty = $state({});
  let jsonMode = $state(false);
  let jsonText = $state('');
  let deleting = $state(false);
  let confirmation = $state('');
  let picking = $state(null);
  let lookupQuery = $state('');
  let lookupRows = $state([]);
  let lookupBusy = $state(false);
  let lookupVersion = 0;
  const modelKey = name => name[0].toLowerCase() + name.slice(1);
  const endpoint = `/api/admin/data/${model.key}`;
  const json = value => JSON.stringify(value, null, 2);
  const display = value => value == null ? '' : typeof value === 'object' ? json(value) : String(value);
  const longField = field => field.type === 'Json' || /description|settings|terms|content|notes|snapshot|signature|template|prompt|reason|message|detail|metadata|ratesJson/i.test(field.name);

  function set(field, value) { draft[field.name] = value; dirty[field.name] = true; }
  function localDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
  }
  async function load() {
    loading = true;
    errorMessage = '';
    try {
      if (recordId) {
        const response = await fetch(`${endpoint}/${encodeURIComponent(recordId)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to open record');
        original = result.record;
        draft = { ...result.record };
        delete draft.id;
        related = result.related;
        secretsSet = result.secretsSet;
      } else {
        draft = Object.fromEntries(model.fields.filter(field => field.defaultValue !== undefined).map(field => [field.name, field.defaultValue]));
      }
      jsonText = json(draft);
    } catch (err) { errorMessage = err.message; }
    finally { loading = false; }
  }
  function toggleJson() {
    errorMessage = '';
    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Record data must be a JSON object');
        draft = parsed;
        dirty = Object.fromEntries(Object.keys(parsed).map(key => [key, true]));
      } catch (err) { errorMessage = err.message; return; }
    } else jsonText = json(draft);
    jsonMode = !jsonMode;
  }
  async function save(event) {
    event.preventDefault();
    saving = true; errorMessage = '';
    try {
      let data = jsonMode ? JSON.parse(jsonText) : { ...draft };
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Record data must be a JSON object');
      if (!jsonMode) for (const field of model.fields) {
        if (field.type === 'Json' && dirty[field.name] && typeof data[field.name] === 'string') {
          try { data[field.name] = JSON.parse(data[field.name]); } catch { throw new Error(`${field.label} must contain valid JSON`); }
        }
      }
      if (recordId) data = Object.fromEntries(Object.entries(data).filter(([key, value]) => json(value) !== json(original[key])));
      const response = await fetch(recordId ? `${endpoint}/${encodeURIComponent(recordId)}` : endpoint, {
        method: recordId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, revision: original.updatedAt || null })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to save record');
      await onsaved(result);
    } catch (err) { errorMessage = err.message; }
    finally { saving = false; }
  }
  async function remove() {
    if (confirmation !== recordId) return;
    saving = true; errorMessage = '';
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(recordId)}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, revision: original.updatedAt || null })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to delete record');
      await onsaved(result);
    } catch (err) { errorMessage = err.message; }
    finally { saving = false; }
  }
  async function lookup(field = picking) {
    picking = field;
    const version = ++lookupVersion;
    lookupBusy = true;
    try {
      const response = await fetch(`/api/admin/data/${modelKey(field.reference.model)}?q=${encodeURIComponent(lookupQuery)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to search related records');
      if (version === lookupVersion) lookupRows = result.rows;
    } catch (err) { errorMessage = err.message; }
    finally { if (version === lookupVersion) lookupBusy = false; }
  }
  onMount(() => { dialog.showModal(); load(); return () => { ++lookupVersion; }; });
</script>

<dialog bind:this={dialog} oncancel={event => { event.preventDefault(); if (!saving) onclose(); }} class="w-[min(960px,calc(100%-32px))] max-h-[90dvh] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">
  <header class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-white px-5 py-4">
    <div><p class="text-xs font-bold uppercase tracking-wide text-indigo-600">{model.label}</p><h2 class="text-xl font-bold">{recordId ? 'Edit record' : 'Create record'}</h2>{#if recordId}<p class="mt-1 break-all font-mono text-xs text-slate-500">{recordId}</p>{/if}</div>
    <button type="button" onclick={onclose} disabled={saving} class="rounded-lg border px-3 py-2 text-sm">Close</button>
  </header>
  <div class="p-5">
    {#if errorMessage}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>{/if}
    {#if loading}<p class="py-10 text-center text-slate-500">Loading record…</p>
    {:else if deleting}
      <h3 class="text-lg font-bold text-red-800">Delete this record permanently?</h3>
      <p class="mt-2 text-sm text-slate-600">Database cascade rules also apply to related records, including nested relationships.</p>
      <div class="my-4 space-y-2">{#each related.filter(item => item.count) as relation}<a target="_blank" rel="noreferrer" class="block rounded-lg border p-3 text-sm hover:bg-slate-50" href={`/admin/data/${relation.model}?referenceField=${relation.fields[0]}&referenceId=${encodeURIComponent(relation.parentValues[0])}`}>{relation.count} {relation.label} · {relation.onDelete === 'Cascade' ? 'deleted with this record' : relation.onDelete === 'SetNull' ? 'reference cleared' : 'may prevent deletion'} →</a>{/each}</div>
      <label class="block text-sm font-semibold">Type the record ID to confirm<input class="mt-2 w-full rounded-lg border-slate-300 font-mono text-sm" bind:value={confirmation} autocomplete="off" /></label>
      <div class="mt-4 flex gap-2"><button type="button" onclick={remove} disabled={saving || confirmation !== recordId} class="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Deleting…' : 'Permanently delete'}</button><button type="button" onclick={() => deleting = false} disabled={saving} class="rounded-lg border px-4 py-2 text-sm">Cancel</button></div>
    {:else}
      {#if ['Invoice', 'PayoutRelease', 'Shipment'].includes(model.name)}<p class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This editor changes stored records. Use the payment and shipping workflows to charge, refund, transfer money, or buy labels.</p>{/if}
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm"><p class="text-slate-500">Fields marked * are required on creation. Dates use your local time.</p><button type="button" onclick={toggleJson} class="font-semibold text-indigo-700">{jsonMode ? 'Use field form' : 'Edit as JSON'}</button></div>
      <form onsubmit={save}>
        {#if jsonMode}
          <label class="block text-sm font-semibold">Record JSON<textarea bind:value={jsonText} rows="22" spellcheck="false" class="mt-2 w-full rounded-lg border-slate-300 font-mono text-xs"></textarea></label>
          <p class="mt-2 text-xs text-slate-500">Omitted fields remain unchanged when editing. Use null to clear nullable fields. Passwords and tokens are write-only.</p>
        {:else}
          <div class="grid gap-5 sm:grid-cols-2">
            {#each model.fields.filter(field => !(recordId && field.id)) as field}
              <div class={longField(field) ? 'sm:col-span-2' : ''}>
                <label class="block text-sm font-semibold">
                  {field.label}{!recordId && field.required ? ' *' : ''}<span class="ml-1 text-xs font-normal text-slate-400">{field.type}{field.secret ? ' · write-only' : ''}</span>
                  {#if field.values || field.type === 'Boolean'}
                    <select disabled={draft[field.name] === null} class="mt-1 w-full rounded-lg border-slate-300 text-sm disabled:bg-slate-100" value={draft[field.name] === undefined || draft[field.name] === null ? '' : String(draft[field.name])} onchange={event => set(field, field.type === 'Boolean' ? event.currentTarget.value === 'true' : event.currentTarget.value)} required={!recordId && field.required}>
                      <option value="" disabled>Select a value</option>{#each field.values || ['true', 'false'] as value}<option {value}>{value}</option>{/each}
                    </select>
                  {:else if longField(field)}
                    <textarea disabled={draft[field.name] === null} rows="4" spellcheck="false" class="mt-1 w-full rounded-lg border-slate-300 text-sm disabled:bg-slate-100" value={display(draft[field.name])} oninput={event => set(field, event.currentTarget.value)} required={!recordId && field.required}></textarea>
                  {:else if field.type === 'DateTime'}
                    <input type="datetime-local" step="0.001" disabled={draft[field.name] === null} class="mt-1 w-full rounded-lg border-slate-300 text-sm disabled:bg-slate-100" value={localDate(draft[field.name])} oninput={event => set(field, event.currentTarget.value ? new Date(event.currentTarget.value).toISOString() : '')} required={!recordId && field.required} />
                  {:else}
                    <input type={field.secret ? 'password' : ['Int', 'Float'].includes(field.type) ? 'number' : 'text'} step={field.type === 'Int' ? '1' : 'any'} disabled={draft[field.name] === null} autocomplete="off" class="mt-1 w-full rounded-lg border-slate-300 text-sm disabled:bg-slate-100" value={display(draft[field.name])} oninput={event => set(field, event.currentTarget.value)} required={!recordId && field.required} placeholder={field.secret ? secretsSet[field.name] ? 'Already set · leave blank to keep' : 'Not set' : field.generated ? 'Generated if omitted' : ''} />
                  {/if}
                </label>
                {#if field.nullable}<label class="mt-1 flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={draft[field.name] === null} onchange={event => set(field, event.currentTarget.checked ? null : field.type === 'Boolean' ? false : '')} class="rounded border-slate-300" />{field.secret ? 'Clear stored value' : 'Set null'}</label>{/if}
                {#if field.secret && model.name === 'User' && field.name === 'password'}<p class="mt-1 text-xs text-slate-500">Enter a new password (8–32 characters). It will be hashed on the server.</p>{/if}
                {#if field.reference}
                  <div class="mt-1 flex gap-3 text-xs"><button type="button" class="font-semibold text-indigo-700" onclick={() => { lookupQuery = ''; lookupRows = []; lookup(field); }}>Find {field.reference.model.replace(/([a-z])([A-Z])/g, '$1 $2')}</button>{#if draft[field.name]}<a class="text-indigo-700 underline" target="_blank" rel="noreferrer" href={`/admin/data/${modelKey(field.reference.model)}?record=${encodeURIComponent(draft[field.name])}`}>Open related record ↗</a>{/if}</div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
        <div class="sticky bottom-0 mt-6 flex flex-wrap justify-between gap-3 border-t bg-white py-4"><button type="submit" disabled={saving} class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : recordId ? 'Save changes' : 'Create record'}</button>{#if recordId}<button type="button" disabled={saving} onclick={() => deleting = true} class="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Delete record…</button>{/if}</div>
      </form>
      {#if recordId && related.some(item => item.count)}
        <section class="mt-4 border-t pt-4"><h3 class="font-semibold">Related records</h3><div class="mt-2 grid gap-2 sm:grid-cols-2">{#each related.filter(item => item.count) as relation}<a class="rounded-lg border px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50" href={`/admin/data/${relation.model}?referenceField=${relation.fields[0]}&referenceId=${encodeURIComponent(relation.parentValues[0])}`} target="_blank" rel="noreferrer">{relation.label} · {relation.relation} · {relation.count} ↗</a>{/each}</div></section>
      {/if}
    {/if}
    {#if picking}
      <section class="mt-5 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4" aria-label="Choose related record"><div class="flex justify-between gap-3"><h3 class="font-semibold">Choose {picking.reference.model}</h3><button type="button" onclick={() => { picking = null; ++lookupVersion; }}>Close picker</button></div><div class="mt-3 flex gap-2"><input bind:value={lookupQuery} aria-label="Search related records" class="min-w-0 flex-1 rounded-lg border-slate-300 text-sm" placeholder="Search name, ID, or email" /><button type="button" onclick={() => lookup()} class="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">Search</button></div><div class="mt-3 max-h-64 overflow-y-auto">{#if lookupBusy}<p class="text-sm">Searching…</p>{:else}{#each lookupRows as row}<button type="button" class="mb-2 block w-full rounded-lg border bg-white p-3 text-left text-sm hover:border-indigo-400" onclick={() => { set(picking, row[picking.reference.field]); picking = null; }}><span class="block font-semibold">{row.title || row.name || row.email || row.number || row.id}</span><span class="block break-all font-mono text-xs text-slate-500">{row.id}</span></button>{/each}{#if !lookupRows.length}<p class="text-sm text-slate-500">No matching records.</p>{/if}{/if}</div></section>
    {/if}
  </div>
</dialog>
