<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { translate } from '$lib/i18n.js';
  import { page } from '$app/stores';
  const t = (text, values) => translate($page.data.locale || 'en', text, values);

  import { onMount } from 'svelte';
  import { blankAddress, formatAddress } from '$lib/utils/addresses.js';
  let { user, onchanged = () => {} } = $props();
  let addresses = $state([]);
  let defaults = $state(blankAddress());
  let loading = $state(true);
  let busy = $state(false);
  let open = $state(false);
  let problem = $state('');
  let form = $state({ ...blankAddress(), label: '', isDefault: false });
  async function api(method = 'GET', body) {
    const response = await fetch('/api/account/addresses', { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || ui("Unable to update addresses"));
    addresses = result.addresses; defaults = result.defaultShippingAddress;
    onchanged({ ...result, changed: method !== 'GET' });
  }
  onMount(async () => { try { await api(); } catch (err) { problem = err.message; } finally { loading = false; } });
  function add() { form = { ...blankAddress(), ...(addresses.length ? {} : defaults), name: user.name || '', phone: user.phone || '', country: defaults.country || 'US', label: addresses.length ? '' : ui("Home"), isDefault: !addresses.length }; open = true; }
  async function save(input, close = false) {
    busy = true; problem = '';
    try { await api('POST', input); if (close) open = false; } catch (err) { problem = err.message; } finally { busy = false; }
  }
  async function remove(item) {
    if (!confirm(ui("Delete {value0}? Addresses already used on invoices will stay on those invoices.", { value0: item.label }))) return;
    busy = true; problem = '';
    try { await api('DELETE', { id: item.id }); if (form.id === item.id) open = false; } catch (err) { problem = err.message; } finally { busy = false; }
  }
</script>
<section id="saved-addresses" class="mt-8 border-t border-gray-200 pt-6">
  <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-semibold">{t("Saved shipping addresses")}</h2><p class="mt-1 text-sm text-slate-600">{t("Choose a default for checkout, and save other delivery addresses here.")}</p></div><button type="button" class="pumbi-btn-secondary" disabled={busy || loading} onclick={add}>{t("Add address")}</button></div>
  {#if problem}<p role="alert" class="mt-4 text-sm text-red-800">{ui(problem)}</p>{/if}
  {#if loading}<p class="mt-4 text-sm text-slate-500">{t("Loading addresses…")}</p>{/if}
  <div class="mt-4 grid gap-3 sm:grid-cols-2">{#each addresses as item}<article class="border border-gray-200 bg-[#f7f4ee] p-4"><h3 class="font-semibold">{item.label} {#if item.isDefault}<span class="ms-2 text-xs text-emerald-800">{t("Default")}</span>{/if}</h3><p class="mt-2 whitespace-pre-line text-sm">{formatAddress(item)}</p><div class="mt-4 flex flex-wrap gap-3 text-xs font-bold"><button type="button" disabled={busy} onclick={() => { form = { ...item, name: item.name || '', street2: item.street2 || '', state: item.state || '', zip: item.zip || '', phone: item.phone || '' }; open = true; }}>{t("Edit")}</button>{#if !item.isDefault}<button type="button" disabled={busy} onclick={() => save({ ...item, isDefault: true })}>{t("Make default")}</button>{/if}<button type="button" disabled={busy} class="text-red-800" onclick={() => remove(item)}>{t("Delete")}</button></div></article>{/each}</div>
  {#if !loading && !addresses.length}<p class="mt-3 text-sm text-slate-500">{t("Your existing profile address is used until you save a structured address here.")}</p>{/if}
  {#if open}<form class="mt-5 space-y-4 border border-gray-200 p-4" onsubmit={event => { event.preventDefault(); save(form, true); }}><div class="grid gap-3 sm:grid-cols-2">
    {#each [['label','Label (Home, Office, etc.)',80],['name','Recipient name',160],['street1','Street',200],['street2','Apartment / suite',200],['city','City',120],['state','State / province',120],['zip','Postal code',30],['country','Country code (US, GB, etc.)',2],['phone','Delivery phone',50]] as [key,label,max]}
      <label class="text-sm font-semibold">{t(label)}<input class="mt-1 w-full border border-gray-300 bg-white p-2 font-normal" bind:value={form[key]} maxlength={max} required={['label','street1','city','country'].includes(key)} disabled={busy} /></label>
    {/each}
  </div><label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={form.isDefault} disabled={busy} />{t("Use as default address")}</label><p class="text-xs text-slate-500">{t("Your current default stays selected until another address is made default.")}</p><div class="flex gap-3"><button class="pumbi-btn" disabled={busy}>{t(busy ? 'Saving…' : 'Save address')}</button><button type="button" class="pumbi-btn-secondary" disabled={busy} onclick={() => open = false}>{t("Cancel")}</button></div></form>{/if}
</section>
