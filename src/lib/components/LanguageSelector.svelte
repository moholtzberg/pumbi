<script>
  import { page } from '$app/stores';
  let busy = $state(false);
  let failure = $state('');
  async function change(event) {
    busy = true; failure = '';
    try {
      const result = await fetch('/api/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: event.currentTarget.value }) });
      if (!result.ok) throw new Error('Unable to change language / לא ניתן לשנות שפה');
      window.location.reload();
    } catch (err) { failure = err.message; busy = false; }
  }
</script>
<label class="language-selector"><span class="sr-only">Language / שפה</span><select aria-label="Language / שפה" value={$page.data.locale || 'en'} onchange={change} disabled={busy} class="border border-[var(--pumbi-line)] bg-white px-2 py-1 text-sm" dir="ltr"><option value="en">English</option><option value="he">עברית</option></select></label>
{#if failure}<span role="alert" class="text-xs text-red-700">{failure}</span>{/if}
