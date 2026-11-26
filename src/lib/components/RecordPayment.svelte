<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { invalidateAll } from '$app/navigation';

  let { invoice, disabled = false } = $props();
  let open = $state(false);
  let method = $state('cash');
  let checkNumber = $state('');
  let notes = $state('');
  let busy = $state(false);
  let errorMessage = $state('');

  function money(amount) {
    return new Intl.NumberFormat(uiLocale(), { style: 'currency', currency: invoice.currency || 'USD' }).format(Number(amount || 0));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    errorMessage = '';
    try {
      const response = await fetch(`/api/seller/invoices/${invoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_payment', method, checkNumber, notes })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || ui("Unable to record payment"));
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      await invalidateAll();
      open = false;
    } catch (err) {
      errorMessage = err.message || ui("Unable to record payment");
    } finally {
      busy = false;
    }
  }
</script>

{#if ['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'].includes(invoice.status)}
  {#if !open}
    <button type="button" class="pumbi-btn" {disabled} onclick={() => { open = true; errorMessage = ''; }}>{ui("Record payment")}</button>
  {:else}
    <form onsubmit={submit} class="min-w-0 space-y-3 border border-[var(--pumbi-line)] bg-[var(--pumbi-cream)] p-4 lg:max-w-sm">
      <p class="font-semibold">{ui("Record payment ·")} {invoice.number}</p>
      <p class="text-sm">{ui("Full invoice amount:")} {money(invoice.totalAmount)}</p>
      <label class="block text-sm">{ui("Payment method")}
        <select bind:value={method} disabled={busy} class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2">
          <option value="cash">{ui("Cash")}</option>
          <option value="check">{ui("Check")}</option>
          <option value="card">{ui("Credit card (Stripe)")}</option>
        </select>
      </label>
      {#if method === 'check'}
        <label class="block text-sm">{ui("Check number")}
          <input bind:value={checkNumber} required maxlength="100" disabled={busy} class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" />
        </label>
      {/if}
      {#if method !== 'card'}
        <label class="block text-sm">{ui("Payment notes (optional)")}
          <textarea bind:value={notes} maxlength="1000" disabled={busy} rows="2" class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2"></textarea>
        </label>
        <p class="text-xs text-[var(--pumbi-muted)]">{ui("Confirm you received")} {money(invoice.totalAmount)}{ui(". This records the full invoice as paid.")}</p>
      {:else}
        <p class="text-sm text-[var(--pumbi-ink-soft)]">{ui("Continue to Stripe to manually enter the card details and charge")} {money(invoice.totalAmount)}{ui(". Payment is recorded after Stripe confirms it.")}</p>
      {/if}
      {#if errorMessage}<p role="alert" class="text-sm text-red-700">{ui(errorMessage)}</p>{/if}
      <div class="flex flex-wrap gap-2">
        <button type="submit" class="pumbi-btn" disabled={busy || disabled}>{busy ? ui("Processing…") : method === 'card' ? ui("Continue to Stripe") : ui("Record payment")}</button>
        <button type="button" class="pumbi-btn-secondary" disabled={busy} onclick={() => open = false}>{ui("Cancel")}</button>
      </div>
    </form>
  {/if}
{/if}
