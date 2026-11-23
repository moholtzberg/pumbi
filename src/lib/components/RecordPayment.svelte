<script>
  import { invalidateAll } from '$app/navigation';

  let { invoice, disabled = false } = $props();
  let open = $state(false);
  let method = $state('cash');
  let checkNumber = $state('');
  let notes = $state('');
  let busy = $state(false);
  let errorMessage = $state('');

  function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency || 'USD' }).format(Number(amount || 0));
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
      if (!response.ok) throw new Error(result.message || 'Unable to record payment');
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      await invalidateAll();
      open = false;
    } catch (err) {
      errorMessage = err.message || 'Unable to record payment';
    } finally {
      busy = false;
    }
  }
</script>

{#if ['UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT'].includes(invoice.status)}
  {#if !open}
    <button type="button" class="pumbi-btn" {disabled} onclick={() => { open = true; errorMessage = ''; }}>Record payment</button>
  {:else}
    <form onsubmit={submit} class="min-w-0 space-y-3 border border-[var(--pumbi-line)] bg-[var(--pumbi-cream)] p-4 lg:max-w-sm">
      <p class="font-semibold">Record payment · {invoice.number}</p>
      <p class="text-sm">Full invoice amount: {money(invoice.totalAmount)}</p>
      <label class="block text-sm">Payment method
        <select bind:value={method} disabled={busy} class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2">
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="card">Credit card (Stripe)</option>
        </select>
      </label>
      {#if method === 'check'}
        <label class="block text-sm">Check number
          <input bind:value={checkNumber} required maxlength="100" disabled={busy} class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2" />
        </label>
      {/if}
      {#if method !== 'card'}
        <label class="block text-sm">Payment notes (optional)
          <textarea bind:value={notes} maxlength="1000" disabled={busy} rows="2" class="mt-1 w-full border border-[var(--pumbi-line)] bg-white px-3 py-2"></textarea>
        </label>
        <p class="text-xs text-[var(--pumbi-muted)]">Confirm you received {money(invoice.totalAmount)}. This records the full invoice as paid.</p>
      {:else}
        <p class="text-sm text-[var(--pumbi-ink-soft)]">Continue to Stripe to manually enter the card details and charge {money(invoice.totalAmount)}. Payment is recorded after Stripe confirms it.</p>
      {/if}
      {#if errorMessage}<p role="alert" class="text-sm text-red-700">{errorMessage}</p>{/if}
      <div class="flex flex-wrap gap-2">
        <button type="submit" class="pumbi-btn" disabled={busy || disabled}>{busy ? 'Processing…' : method === 'card' ? 'Continue to Stripe' : 'Record payment'}</button>
        <button type="button" class="pumbi-btn-secondary" disabled={busy} onclick={() => open = false}>Cancel</button>
      </div>
    </form>
  {/if}
{/if}
