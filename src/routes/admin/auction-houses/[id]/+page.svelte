<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
  const uiStatus = value => ui(String(value ?? '').replaceAll('_', ' '));

  import { publicHousePath, houseSlugProblem } from '$lib/utils/houseSlugs.js';
  import { goto, invalidateAll } from '$app/navigation';

  import AdminRecordEditor from '$lib/components/admin/AdminRecordEditor.svelte';
  let { data } = $props();
  let editor = $state(null);
  async function saved(result) { editor = null; if (result.deleted) await goto('/admin/auction-houses'); else { await invalidateAll(); notice = ui("Partner details saved."); } }
  let house = $derived(data.house);
  let email = $state('');
  let newRole = $state('OWNER');
  let busy = $state('');
  let notice = $state('');
  let failure = $state('');

  const roles = ['OWNER', 'ADMIN', 'AUCTION_MANAGER', 'CATALOG_MANAGER', 'FINANCE', 'VIEWER'];
  const statuses = ['ACTIVE', 'SUSPENDED'];
  const date = (value) => value ? new Date(value).toLocaleString(uiLocale()) : '—';
  const label = (value) => value.replaceAll('_', ' ');

  async function requestMembers(method, body) {
    failure = '';
    notice = '';
    const response = await fetch(`/api/admin/auction-houses/${encodeURIComponent(house.id)}/members`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || ui("The team could not be updated"));
    return result;
  }

  async function addMember(event) {
    event.preventDefault();
    busy = 'add';
    try {
      await requestMembers('POST', { email, role: newRole, status: 'ACTIVE' });
      email = '';
      newRole = 'OWNER';
      notice = ui("Team member added.");
      await invalidateAll();
    } catch (error) {
      failure = error.message;
    } finally {
      busy = '';
    }
  }

  async function updateMember(member) {
    busy = member.id;
    try {
      await requestMembers('PATCH', { membershipId: member.id, role: member.role, status: member.status });
      notice = ui("{value0} updated.", { value0: member.user.name || member.user.email });
      await invalidateAll();
    } catch (error) {
      failure = error.message;
      await invalidateAll();
    } finally {
      busy = '';
    }
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.user.name || member.user.email} from ${house.name}?`)) return;
    busy = member.id;
    try {
      await requestMembers('DELETE', { membershipId: member.id });
      notice = ui("Team member removed.");
      await invalidateAll();
    } catch (error) {
      failure = error.message;
    } finally {
      busy = '';
    }
  }
</script>

<svelte:head><title>{house.name} {ui("| Pumbi Admin")}</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-6">
  <a href="/admin/auction-houses" class="text-sm font-semibold text-indigo-600">{ui("← All auction houses")}</a>

  <header class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">{ui("Partner record")}</p>
      <h1 class="mt-1 text-3xl font-black">{house.name}</h1>
      <p class="mt-1 text-sm text-slate-500">{house.legalName || house.slug} · {house.contactEmail || ui("No contact email")}</p>
    </div>
    <span class="rounded-full bg-white px-3 py-1.5 text-sm font-bold shadow-sm">{uiStatus(label(house.onboardingStatus))}</span>
  </header>

  <div class="flex flex-wrap gap-2"><button type="button" onclick={() => editor = { remove: false }} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{ui("Edit house")}</button><a href={`/admin/auctions?house=${encodeURIComponent(house.id)}`} class="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">{ui("Manage auctions")}</a><a href={`/admin/lots?house=${encodeURIComponent(house.id)}`} class="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">{ui("Manage lots")}</a><button type="button" onclick={() => editor = { remove: true }} class="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">{ui("Remove house")}</button></div>
  <div class="rounded-xl border bg-white p-4 text-sm"><span class="font-semibold">{ui("Public address:")}</span> <span class="break-all">{publicHousePath(house.slug)}</span>{#if house.isActive && house.onboardingStatus === 'APPROVED' && !houseSlugProblem(house.slug)}<a href={publicHousePath(house.slug)} target="_blank" rel="noreferrer" class="ms-3 font-semibold text-indigo-600">{ui("Open public page ↗")}</a>{:else}<p class="mt-2 text-slate-500">{ui("A valid slug and an active, approved house are required before this page is public.")}</p>{/if}</div>
  <section class="grid gap-4 sm:grid-cols-3">
    <div class="rounded-2xl border bg-white p-5"><span class="text-xs font-bold uppercase text-slate-400">{ui("Auctions")}</span><strong class="mt-2 block text-3xl">{house._count.auctions}</strong></div>
    <div class="rounded-2xl border bg-white p-5"><span class="text-xs font-bold uppercase text-slate-400">{ui("Payout requests")}</span><strong class="mt-2 block text-3xl">{house._count.payoutReleases}</strong></div>
    <div class="rounded-2xl border bg-white p-5"><span class="text-xs font-bold uppercase text-slate-400">Stripe</span><strong class="mt-2 block text-lg">{uiStatus(label(house.stripeConnectStatus))}</strong></div>
  </section>

  <section class="rounded-2xl border bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><h2 class="font-bold">{ui("Auction house team")}</h2><p class="mt-1 text-sm text-slate-500">{ui("Add registered users and control their access to this auction house.")}</p></div>
      <a href="/admin/users" class="text-sm font-semibold text-indigo-600">{ui("View all users →")}</a>
    </div>

    <form class="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_220px_auto]" onsubmit={addMember}>
      <label class="text-sm font-semibold text-slate-700">{ui("Registered user email")}<input bind:value={email} type="email" required placeholder="person@example.com" class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
      <label class="text-sm font-semibold text-slate-700">{ui("Initial role")}<select bind:value={newRole} class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">{#each roles as role}<option value={role}>{uiStatus(label(role))}</option>{/each}</select></label>
      <button type="submit" disabled={busy === 'add'} class="self-end rounded-lg bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-50">{busy === 'add' ? ui("Adding…") : ui("Add member")}</button>
    </form>
    <p class="mt-2 text-xs text-slate-500">{ui("The user must already have a Pumbi account. New members are active immediately.")}</p>

    {#if notice}<p class="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{ui(notice)}</p>{/if}
    {#if failure}<p class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{ui(failure)}</p>{/if}

    <div class="mt-5 overflow-x-auto">
      <table class="w-full min-w-[760px] text-start text-sm">
        <thead class="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th class="px-3 py-3">{ui("User")}</th><th class="px-3 py-3">{ui("Role")}</th><th class="px-3 py-3">{ui("Status")}</th><th class="px-3 py-3 text-end">{ui("Actions")}</th></tr></thead>
        <tbody class="divide-y">
          {#each house.memberships as member (member.id)}
            <tr>
              <td class="px-3 py-4"><p class="font-semibold">{member.user.name || member.user.email}</p><p class="text-xs text-slate-500">{member.user.email}</p></td>
              <td class="px-3 py-4"><select bind:value={member.role} aria-label={ui("Role for {value0}", { value0: member.user.email })} class="rounded-lg border border-slate-300 bg-white px-2 py-2">{#each roles as role}<option value={role}>{uiStatus(label(role))}</option>{/each}</select></td>
              <td class="px-3 py-4"><select bind:value={member.status} aria-label={ui("Status for {value0}", { value0: member.user.email })} class="rounded-lg border border-slate-300 bg-white px-2 py-2">{#each statuses as status}<option value={status}>{uiStatus(label(status))}</option>{/each}</select></td>
              <td class="px-3 py-4"><div class="flex justify-end gap-2"><button type="button" onclick={() => updateMember(member)} disabled={busy === member.id} class="rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">{ui("Save")}</button><button type="button" onclick={() => removeMember(member)} disabled={busy === member.id} class="rounded-lg px-3 py-2 font-semibold text-red-600 disabled:opacity-50">{ui("Remove")}</button></div></td>
            </tr>
          {/each}
          {#if house.memberships.length === 0}<tr><td colspan="4" class="px-3 py-10 text-center text-slate-500">{ui("No team members yet. Add the first owner above.")}</td></tr>{/if}
        </tbody>
      </table>
    </div>
  </section>

  <section class="rounded-2xl border bg-white p-5 shadow-sm"><h2 class="font-bold">{ui("Locations")}</h2><div class="mt-4 grid gap-3 md:grid-cols-2">{#each house.locations as location}<div class="rounded-xl bg-slate-50 p-3 text-sm"><strong>{location.name || label(location.type)}</strong><p class="mt-1 text-slate-500">{location.addressLine1}, {location.city}{location.country ? `, ${location.country}` : ''}</p></div>{/each}{#if house.locations.length === 0}<p class="py-6 text-sm text-slate-500">{ui("No locations submitted.")}</p>{/if}</div></section>

  <section class="overflow-hidden rounded-2xl border bg-white shadow-sm"><div class="border-b px-5 py-4"><h2 class="font-bold">{ui("Compliance documents")}</h2><p class="text-xs text-slate-500">{ui("Review state and submitted metadata")}</p></div><div class="overflow-x-auto"><table class="w-full min-w-[650px] text-start text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500"><tr><th class="px-5 py-3">{ui("Document")}</th><th class="px-5 py-3">{ui("Status")}</th><th class="px-5 py-3">{ui("Jurisdiction")}</th><th class="px-5 py-3">{ui("Submitted")}</th></tr></thead><tbody class="divide-y">{#each house.documents as document}<tr><td class="px-5 py-4"><strong>{uiStatus(label(document.type))}</strong><div class="text-xs text-slate-500">{document.fileName || document.mimeType}</div></td><td class="px-5 py-4">{uiStatus(document.reviewStatus)}</td><td class="px-5 py-4">{document.jurisdiction || '—'}</td><td class="px-5 py-4">{date(document.createdAt)}</td></tr>{/each}{#if house.documents.length === 0}<tr><td colspan="4" class="px-5 py-10 text-center text-slate-500">{ui("No documents submitted.")}</td></tr>{/if}</tbody></table></div></section>
</div>

{#if editor}{#key `${house.id}:${editor.remove}`}<AdminRecordEditor model={data.model} recordId={house.id} recordLabel={house.name} simple initialDelete={editor.remove} onclose={() => editor = null} onsaved={saved} />{/key}{/if}
