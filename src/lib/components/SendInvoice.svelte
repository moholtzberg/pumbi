<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let { invoice, disabled = false } = $props();
  let sending = $state(false);
  let message = $state('');
  let problem = $state('');
  async function send() {
    if (sending) return;
    sending = true; message = ''; problem = '';
    try {
      const response = await fetch(`/api/seller/invoices/${invoice.id}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_invoice' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.sent !== true) throw new Error(result.message || ui("Unable to send invoice"));
      message = ui("Invoice emailed to {value0}", { value0: result.sentTo });
    } catch (err) { problem = err.message; }
    finally { sending = false; }
  }
</script>

<div class="min-w-0">
  <button type="button" class="pumbi-btn-secondary w-full" disabled={disabled || sending} onclick={send}>{sending ? ui("Sending invoice…") : ui("Send invoice")}</button>
  {#if message}<p role="status" class="mt-2 max-w-xs break-words text-xs text-emerald-800">{ui(message)}</p>{/if}
  {#if problem}<p role="alert" class="mt-2 max-w-xs text-xs text-red-800">{ui(problem)}</p>{/if}
</div>
