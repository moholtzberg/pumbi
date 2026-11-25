<script>
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
      if (!response.ok || result.sent !== true) throw new Error(result.message || 'Unable to send invoice');
      message = `Invoice emailed to ${result.sentTo}`;
    } catch (err) { problem = err.message; }
    finally { sending = false; }
  }
</script>

<div class="min-w-0">
  <button type="button" class="pumbi-btn-secondary w-full" disabled={disabled || sending} onclick={send}>{sending ? 'Sending invoice…' : 'Send invoice'}</button>
  {#if message}<p role="status" class="mt-2 max-w-xs break-words text-xs text-emerald-800">{message}</p>{/if}
  {#if problem}<p role="alert" class="mt-2 max-w-xs text-xs text-red-800">{problem}</p>{/if}
</div>
