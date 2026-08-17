<script>
  let { data } = $props();

  function when(value) {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function location(event) {
    return [event.city, event.region, event.countryCode].filter(Boolean).join(', ') || 'Location unavailable';
  }
</script>

<svelte:head><title>Trust & Safety | Pumbi Admin</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-6">
  <header>
    <p class="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Fraud review</p>
    <h1 class="mt-1 text-3xl font-black">Trust & Safety</h1>
    <p class="mt-1 max-w-3xl text-sm text-slate-500">Review login history and accounts sharing a device or IP address. A match is a review signal, not proof of fraud—households, offices, mobile carriers, and VPNs can legitimately share identifiers.</p>
  </header>

  <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Login security metrics">
    <div class="rounded-2xl border bg-white p-4 shadow-sm"><p class="text-xs font-bold uppercase text-slate-500">Successful logins</p><strong class="mt-2 block text-2xl">{data.metrics.successes}</strong><span class="text-xs text-slate-400">Last {data.windowDays} days</span></div>
    <div class="rounded-2xl border bg-white p-4 shadow-sm"><p class="text-xs font-bold uppercase text-slate-500">Failed logins</p><strong class="mt-2 block text-2xl">{data.metrics.failures}</strong><span class="text-xs text-slate-400">Last {data.windowDays} days</span></div>
    <div class="rounded-2xl border bg-white p-4 shadow-sm"><p class="text-xs font-bold uppercase text-slate-500">Devices</p><strong class="mt-2 block text-2xl">{data.metrics.distinctDevices}</strong><span class="text-xs text-slate-400">Seen on successful logins</span></div>
    <div class="rounded-2xl border bg-white p-4 shadow-sm"><p class="text-xs font-bold uppercase text-slate-500">IP addresses</p><strong class="mt-2 block text-2xl">{data.metrics.distinctIps}</strong><span class="text-xs text-slate-400">Seen on successful logins</span></div>
    <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"><p class="text-xs font-bold uppercase text-rose-700">Shared identifiers</p><strong class="mt-2 block text-2xl text-rose-950">{data.metrics.sharedIdentifiers}</strong><span class="text-xs text-rose-700">Need contextual review</span></div>
  </section>

  <section class="rounded-2xl border bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div><h2 class="font-bold">Account correlations</h2><p class="text-xs text-slate-500">Successful logins sharing a device or IP in the last {data.windowDays} days.</p></div>
    </div>
    {#if data.correlations.length}
      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        {#each data.correlations as correlation}
          <article class="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
            <div class="flex items-start justify-between gap-3"><div><span class="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-rose-700">{correlation.type}</span><p class="mt-2 font-mono text-sm font-semibold text-slate-900">{correlation.label}</p></div><span class="text-xs text-slate-500">{correlation.loginCount} logins</span></div>
            <div class="mt-3 flex flex-wrap gap-2">
              {#each correlation.users as user}<a href={`/admin/users?q=${encodeURIComponent(user.email)}`} class="rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:border-indigo-300">{user.name || user.email}<span class="ml-1 font-normal text-slate-400">{user.email}</span></a>{/each}
            </div>
            <p class="mt-3 text-xs text-slate-400">Last seen {when(correlation.lastSeen)}</p>
          </article>
        {/each}
      </div>
    {:else}
      <p class="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No accounts currently share a recorded device or IP address.</p>
    {/if}
  </section>

  <section class="overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div class="border-b px-5 py-4"><h2 class="font-bold">Login history</h2><p class="text-xs text-slate-500">Most recent 250 matching events. Location is coarse and depends on trusted hosting-provider headers.</p></div>
    <form class="grid gap-3 border-b bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
      <input name="q" value={data.filters.search} class="rounded-lg border-slate-300 text-sm" placeholder="Email, IP, city, or country" aria-label="Search login history" />
      <select name="outcome" value={data.filters.outcome} class="rounded-lg border-slate-300 text-sm" aria-label="Filter login outcome"><option value="">All outcomes</option><option value="SUCCESS">Successful</option><option value="FAILURE">Failed</option></select>
      <button class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filter</button>
    </form>
    <div class="overflow-x-auto"><table class="w-full min-w-[960px] text-left text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-5 py-3">Time</th><th class="px-5 py-3">Account</th><th class="px-5 py-3">Result</th><th class="px-5 py-3">IP address</th><th class="px-5 py-3">Location</th><th class="px-5 py-3">Device</th></tr></thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.events as event}
          <tr class="hover:bg-slate-50"><td class="whitespace-nowrap px-5 py-4 text-slate-600">{when(event.createdAt)}</td><td class="px-5 py-4"><div class="font-semibold">{event.user?.name || event.attemptedEmail || 'Unknown'}</div><div class="text-xs text-slate-400">{event.user?.email || event.attemptedEmail || 'No email recorded'}</div></td><td class="px-5 py-4"><span class={event.outcome === 'SUCCESS' ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700' : 'rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700'}>{event.outcome}</span></td><td class="px-5 py-4 font-mono text-xs">{event.ipAddress || 'Unavailable'}</td><td class="px-5 py-4 text-slate-600">{location(event)}</td><td class="px-5 py-4 font-mono text-xs">{event.deviceIdHash ? `…${event.deviceIdHash.slice(-10)}` : 'Unavailable'}</td></tr>
        {/each}
        {#if data.events.length === 0}<tr><td colspan="6" class="px-5 py-12 text-center text-slate-500">No login events match these filters.</td></tr>{/if}
      </tbody>
    </table></div>
  </section>
</div>
