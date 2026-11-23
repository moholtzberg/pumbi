<script>
  let { data } = $props();
  let search = $state('');
  let collections = $derived(data.collections.filter(model => `${model.label} ${model.key}`.toLowerCase().includes(search.toLowerCase())));
</script>

<svelte:head><title>Data manager | Pumbi Admin</title></svelte:head>
<div class="mx-auto max-w-7xl space-y-6">
  <header><p class="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Platform data</p><h1 class="mt-1 text-3xl font-black">Data manager</h1><p class="mt-2 max-w-3xl text-sm text-slate-500">Create, inspect, edit, and delete records across every collection. Related records are linked from each editor.</p></header>
  <input type="search" bind:value={search} placeholder="Find a collection…" aria-label="Find a data collection" class="w-full max-w-md rounded-lg border-slate-300 text-sm" />
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {#each collections as collection}
      <a href={`/admin/data/${collection.key}`} class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"><p class="font-semibold">{collection.label}</p><p class="mt-3 text-3xl font-black tabular-nums">{collection.count.toLocaleString()}</p><p class="mt-2 text-sm font-semibold text-indigo-600">Manage records →</p></a>
    {/each}
  </div>
  {#if !collections.length}<p class="py-10 text-center text-slate-500">No collections match your search.</p>{/if}
</div>
