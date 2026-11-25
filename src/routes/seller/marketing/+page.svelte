<script>
  import { onMount } from 'svelte';
  let { data } = $props();
  let overview = $state(null);
  let auctionId = $state('');
  let search = $state('');
  let page = $state(1);
  let busy = $state(false);
  let problem = $state('');
  let success = $state('');
  let selected = $state([]);
  let contact = $state({ name: '', email: '', phone: '', tags: '', notes: '' });
  let editing = $state(null);
  let csv = $state('');
  let importMode = $state(false);
  let consentConfirmed = $state(false);
  let inviteAfterAdd = $state(true);
  let settings = $state({ enabled: true, auctionReminders: true, lotReminders: true, reminderMinutes: 30, subject: '', message: '' });
  let updateSubject = $state('');
  let updateMessage = $state('');
  let updateRequestId = $state(null);
  const endpoint = `/api/auction-houses/${data.marketingHouse.id}/marketing`;
  let campaign = $derived(overview?.campaign);
  let selectedAuction = $derived(overview?.auctions.find(item => item.id === auctionId));
  const dates = value => value ? new Date(value).toLocaleString() : '—';
  const label = value => String(value).toLowerCase().replaceAll('_', ' ');
  async function request(url, options) {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || result.error || 'Could not complete this action');
    return result;
  }
  async function refresh(hydrate = false) {
    const params = new URLSearchParams({ auctionId, q: search, page: String(page) });
    let result = await request(`${endpoint}?${params}`);
    if (!auctionId && result.auctions.length) {
      auctionId = result.auctions[0].id;
      params.set('auctionId', auctionId);
      result = await request(`${endpoint}?${params}`);
      hydrate = true;
    }
    overview = result;
    if (hydrate) settings = result.campaign ? {
      enabled: result.campaign.enabled, auctionReminders: result.campaign.auctionReminders,
      lotReminders: result.campaign.lotReminders, reminderMinutes: result.campaign.reminderMinutes,
      subject: result.campaign.subject || '', message: result.campaign.message || ''
    } : { enabled: true, auctionReminders: true, lotReminders: true, reminderMinutes: 30, subject: '', message: '' };
  }
  async function run(action, payload, message) {
    busy = true; problem = ''; success = '';
    try {
      const result = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      success = typeof message === 'function' ? message(result) : message;
      await refresh();
      return result;
    } catch (err) { problem = err.message; return null; }
    finally { busy = false; }
  }
  async function reload(hydrate = false) {
    busy = true; problem = '';
    try { await refresh(hydrate); } catch (err) { problem = err.message; } finally { busy = false; }
  }
  onMount(() => { reload(true); });
  async function saveContacts(event) {
    event.preventDefault();
    const result = await run('save_contacts', { ...(importMode ? { csv } : { contact }), consentConfirmed, auctionId: inviteAfterAdd ? auctionId : null }, r => `${r.saved} contact(s) saved. ${r.queued} invitation(s) queued. ${r.skippedOptOuts ? `${r.skippedOptOuts} unsubscribed contact(s) kept opted out.` : ''}`);
    if (result) { contact = { name: '', email: '', phone: '', tags: '', notes: '' }; csv = ''; consentConfirmed = false; }
  }
  async function fileChanged(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { problem = 'Choose a CSV no larger than 2 MB'; return; }
    csv = await file.text();
    event.target.value = '';
  }
  function selectContact(id, checked) { selected = checked ? [...new Set([...selected, id])] : selected.filter(value => value !== id); }
  async function saveEdit(event) {
    event.preventDefault();
    if (await run('edit_contact', { contactId: editing.id, contact: editing, subscribed: editing.subscribed }, 'Contact updated.')) editing = null;
  }
  async function sendUpdate(event) {
    event.preventDefault();
    updateRequestId ||= crypto.randomUUID();
    const result = await run('update', { auctionId, subject: updateSubject, message: updateMessage, requestId: updateRequestId }, r => `${r.queued} update email(s) queued.`);
    if (result) { updateSubject = ''; updateMessage = ''; updateRequestId = null; }
  }
</script>

<svelte:head><title>Marketing & contacts | Pumbi</title></svelte:head>
<main class="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div><p class="pumbi-eyebrow">{data.marketingHouse.name} · Seller CRM</p><h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-4xl font-semibold">Marketing & contacts</h1><p class="mt-3 max-w-2xl text-sm text-slate-600">Bring your audience to the auction. Manage contacts, invite bidders, and keep them informed by email.</p></div>
    <button class="secondary" disabled={busy} onclick={() => reload()}>Refresh activity</button>
  </header>
  {#if problem}<p role="alert" class="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{problem}</p>{/if}
  {#if success}<p role="status" class="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{success}</p>{/if}
  {#if !overview}<p class="py-10 text-slate-500">Loading contacts…</p>{:else}
    {#if !overview.emailConfigured}<p class="border border-amber-200 bg-amber-50 p-4 text-sm">Email sending needs to be configured by the platform administrator. You can still organize contacts and save email settings.</p>{/if}
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      {#each [['Contacts', overview.totalContacts], ['Subscribed contacts', overview.subscribed], ['Emails accepted', overview.statuses.SENT || 0], ['House opt-outs', overview.optedOut]] as stat}
        <div class="border border-[#ded8ce] bg-white/60 p-5"><p class="text-xs font-bold uppercase tracking-wider text-slate-500">{stat[0]}</p><p class="mt-2 text-3xl font-semibold">{stat[1]}</p></div>
      {/each}
    </div>

    <section class="panel space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-4"><div><h2>Auction emails</h2><p class="hint">Choose an auction, save its settings, then invite your contacts.</p></div><label class="min-w-64">Auction<select bind:value={auctionId} disabled={busy} onchange={() => reload(true)}><option value="" disabled>Choose an auction</option>{#each overview.auctions as auction}<option value={auction.id}>{auction.title} · {label(auction.status)}</option>{/each}</select></label></div>
      {#if selectedAuction}
        <p class="text-sm text-slate-600">Scheduled start: {dates(selectedAuction.startDate)} · {campaign?._count.enrollments || 0} invited contacts enrolled</p>
        <form onsubmit={event => { event.preventDefault(); run('save_campaign', { auctionId, ...settings }, 'Auction email settings saved.'); }} class="space-y-5">
          <div class="grid gap-4 md:grid-cols-3">
            <label class="check"><input type="checkbox" bind:checked={settings.enabled} />Enable marketing emails for this auction</label>
            <label class="check"><input type="checkbox" bind:checked={settings.auctionReminders} />Email invited contacts & approved bidders before start</label>
            <label class="check"><input type="checkbox" bind:checked={settings.lotReminders} />Email watchers when their lot is next up or live</label>
          </div>
          <div class="grid gap-4 md:grid-cols-3"><label>Reminder before auction (minutes)<input type="number" min="5" max="1440" required bind:value={settings.reminderMinutes} /></label><label class="md:col-span-2">Invitation subject (optional)<input maxlength="180" bind:value={settings.subject} placeholder={`You're invited: ${selectedAuction.title}`} /></label></div>
          <label>Invitation message (optional)<textarea rows="3" maxlength="8000" bind:value={settings.message} placeholder="Leave blank for an invitation with the auction name, start time, and registration instructions."></textarea></label>
          <p class="hint">Each email includes the auction link and an unsubscribe link. Watching a lot triggers a reminder when it reaches the front of the live queue. Account recipients must have a verified email. Phone numbers are stored for your records; these campaigns send email.</p>
          <button class="primary" disabled={busy}>Save auction email settings</button>
        </form>
      {:else}<p class="hint">Create an upcoming auction to start inviting contacts.</p>{/if}
    </section>

    <div class="grid items-start gap-6 lg:grid-cols-2">
      <section class="panel space-y-4">
        <div class="flex items-center justify-between gap-3"><h2>{importMode ? 'Import contacts' : 'Add a contact'}</h2><button class="link" onclick={() => importMode = !importMode}>{importMode ? 'Add one person' : 'Upload CSV'}</button></div>
        <form onsubmit={saveContacts} class="space-y-4">
          {#if importMode}
            <p class="hint">Import up to 500 contacts. Emails are deduplicated within your house. Existing contact details are updated; opt-outs stay in place.</p>
            <a class="link" href="/marketing-contacts-template.csv" download>Download CSV template →</a>
            <label>CSV file<input type="file" accept=".csv,text/csv" onchange={fileChanged} /></label>
            <label>Review or paste CSV<textarea rows="6" bind:value={csv} required placeholder="name,email,phone,tags,notes"></textarea></label>
          {:else}
            <div class="grid gap-3 sm:grid-cols-2"><label>Name<input bind:value={contact.name} maxlength="160" /></label><label>Email<input type="email" bind:value={contact.email} maxlength="254" required /></label><label>Phone<input type="tel" bind:value={contact.phone} maxlength="50" /></label><label>Tags<input bind:value={contact.tags} maxlength="250" placeholder="books, silver, regular buyer" /></label></div>
            <label>Notes<textarea rows="2" bind:value={contact.notes} maxlength="2000"></textarea></label>
          {/if}
          <label class="check"><input type="checkbox" bind:checked={consentConfirmed} required />These contacts agreed to receive auction invitations and updates from our house.</label>
          <label class="check"><input type="checkbox" bind:checked={inviteAfterAdd} />Automatically invite these contacts to the selected auction</label>
          {#if inviteAfterAdd && !campaign}<p class="hint">Save the selected auction’s email settings before adding and inviting contacts.</p>{/if}
          <button class="primary" disabled={busy || (inviteAfterAdd && (!campaign?.enabled || !auctionId))}>{inviteAfterAdd ? 'Save contacts & queue invitations' : 'Save contacts'}</button>
        </form>
      </section>
      <section class="panel space-y-4">
        <h2>Send an auction update</h2><p class="hint">Send a message to this auction’s subscribed invited contacts. Use this for catalog additions, viewing hours, or schedule changes.</p>
        <form onsubmit={sendUpdate} class="space-y-4">
          <label>Subject<input bind:value={updateSubject} oninput={() => updateRequestId = null} maxlength="180" required placeholder="New lots have been added" /></label>
          <label>Message<textarea rows="5" bind:value={updateMessage} oninput={() => updateRequestId = null} maxlength="8000" required placeholder="Tell your bidders what’s new…"></textarea></label>
          <p class="hint">The email will include this message, a link to {selectedAuction?.title || 'your auction'}, and an unsubscribe link.</p>
          <button class="primary" disabled={busy || !campaign?.enabled || !overview.emailConfigured}>Queue update to {campaign?._count.enrollments || 0} invited contacts</button>
        </form>
      </section>
    </div>

    {#if editing}
      <section class="panel border-[#a95739] space-y-4">
        <h2>Edit {editing.email}</h2>
        <form onsubmit={saveEdit} class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-3"><label>Name<input bind:value={editing.name} maxlength="160" /></label><label>Phone<input bind:value={editing.phone} maxlength="50" /></label><label>Tags<input bind:value={editing.tags} maxlength="250" /></label></div>
          <label>Notes<textarea bind:value={editing.notes} maxlength="2000"></textarea></label>
          <label class="check"><input type="checkbox" bind:checked={editing.subscribed} />Subscribed to auction emails (recipient opt-outs cannot be overridden)</label>
          <div class="flex gap-3"><button class="primary" disabled={busy}>Save contact</button><button type="button" class="secondary" onclick={() => editing = null}>Cancel</button></div>
        </form>
      </section>
    {/if}

    <section class="panel space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-4"><div><h2>Your contacts</h2><p class="hint">{overview.count} matching contacts · {selected.length} selected</p></div><form class="flex items-end gap-2" onsubmit={event => { event.preventDefault(); page = 1; selected = []; reload(); }}><label>Search<input bind:value={search} placeholder="Name, email, phone, tags" /></label><button class="secondary" disabled={busy}>Search</button></form></div>
      <div class="flex flex-wrap gap-2">
        <button class="secondary" disabled={busy || !overview.contacts.length} onclick={() => selected = overview.contacts.filter(c => c.subscribed).map(c => c.id)}>Select this page</button>
        <button class="secondary" disabled={busy || !selected.length} onclick={() => selected = []}>Clear selection</button>
        <button class="primary" disabled={busy || !selected.length || !campaign?.enabled || !overview.emailConfigured} onclick={() => run('invite', { auctionId, contactIds: selected }, r => `${r.queued} new invitation(s) queued. Already-invited contacts were skipped.`)}>Invite selected</button>
        <button class="secondary" disabled={busy || !overview.subscribed || !campaign?.enabled || !overview.emailConfigured} onclick={() => run('invite', { auctionId }, r => `${r.queued} new invitation(s) queued. Already-invited contacts were skipped.`)}>Invite all subscribed contacts</button>
      </div>
      <div class="overflow-x-auto"><table><thead><tr><th>Select</th><th>Contact</th><th>Phone</th><th>Tags / notes</th><th>Email status</th><th>Actions</th></tr></thead><tbody>
        {#each overview.contacts as person (person.id)}
          <tr><td><input type="checkbox" aria-label={`Select ${person.email}`} checked={selected.includes(person.id)} onchange={event => selectContact(person.id, event.target.checked)} disabled={!person.subscribed} /></td><td><strong>{person.name || 'Unnamed contact'}</strong><br /><span class="text-slate-500">{person.email}</span></td><td>{person.phone || '—'}</td><td><span>{person.tags || '—'}</span>{#if person.notes}<p class="mt-1 max-w-xs whitespace-pre-wrap text-xs text-slate-500">{person.notes}</p>{/if}</td><td><span class:subscribed={person.subscribed} class="badge">{person.subscribed ? 'Subscribed' : 'Paused / opted out'}</span></td><td><div class="flex gap-3"><button class="link" onclick={() => editing = { ...person, name: person.name || '', phone: person.phone || '', tags: person.tags || '', notes: person.notes || '' }}>Edit</button><button class="text-red-700" disabled={busy} onclick={() => { if (confirm(`Delete ${person.email} from your CRM? Their unsubscribe preference will be preserved.`)) run('delete_contact', { contactId: person.id }, 'Contact deleted.'); }}>Delete</button></div></td></tr>
        {:else}<tr><td colspan="6" class="py-8 text-center text-slate-500">No contacts yet. Add a person or upload your first CSV.</td></tr>{/each}
      </tbody></table></div>
      <div class="flex items-center justify-between"><button class="secondary" disabled={busy || page <= 1} onclick={() => { page--; reload(); }}>Previous</button><p class="hint">Page {page} of {Math.max(1, Math.ceil(overview.count / 30))}</p><button class="secondary" disabled={busy || page * 30 >= overview.count} onclick={() => { page++; reload(); }}>Next</button></div>
    </section>

    <section class="panel space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4"><div><h2>Email activity</h2><p class="hint">{overview.statuses.QUEUED || 0} queued · {overview.statuses.SENT || 0} accepted · {overview.statuses.FAILED || 0} failed · {overview.statuses.UNKNOWN || 0} unconfirmed</p></div><button class="secondary" disabled={busy || !overview.emailConfigured} onclick={() => run('process', {}, r => `${r.accepted} email(s) accepted, ${r.cancelled} skipped, ${r.failed} failed, ${r.unknown} unconfirmed.`)}>Process queued emails now</button></div>
      <p class="hint">Emails are queued for the scheduler. “Accepted” means SMTP2GO accepted the email, not that it reached the inbox. Unconfirmed sends are never retried automatically. Check SMTP2GO activity before sending a replacement.</p>
      <div class="overflow-x-auto"><table><thead><tr><th>Recipient</th><th>Email</th><th>Status</th><th>Queued / sent</th><th>Details</th></tr></thead><tbody>
        {#each overview.history as item (item.id)}<tr><td>{item.email}</td><td><span class="capitalize">{label(item.kind)}</span>{#if item.subject}<p class="mt-1 text-xs text-slate-500">{item.subject}</p>{/if}</td><td><span class="badge" class:subscribed={item.status === 'SENT'}>{item.status === 'SENT' ? 'Accepted' : label(item.status)}</span></td><td class="whitespace-nowrap text-xs">{dates(item.sentAt || item.createdAt)}</td><td><p class="max-w-xs text-xs text-slate-500">{item.error || '—'}</p>{#if item.status === 'FAILED'}<button class="link mt-2" disabled={busy} onclick={() => run('retry', { messageId: item.id }, 'Email requeued after a known rejection.')}>Retry</button>{/if}</td></tr>{:else}<tr><td colspan="5" class="py-8 text-center text-slate-500">Invitations, updates, and reminders will appear here.</td></tr>{/each}
      </tbody></table></div>
    </section>
  {/if}
</main>

<style>
  .panel{border:1px solid #ded8ce;background:rgba(255,255,255,.65);padding:24px}
  h2{font-family:var(--pumbi-serif),Georgia,serif;font-size:1.65rem;font-weight:600}
  .hint{font-size:13px;line-height:1.6;color:#647068;margin-top:5px}
  label{display:block;font-size:13px;font-weight:600;color:#37453d}
  input:not([type=checkbox]),select,textarea{display:block;width:100%;margin-top:6px;border:1px solid #d4d6cf;background:white;padding:10px 12px;font-size:14px;font-weight:400;color:#1a2821}
  input[type=checkbox]{width:16px;height:16px;accent-color:#18372f;flex-shrink:0;margin-top:2px}
  .check{display:flex;align-items:flex-start;gap:9px;font-size:13px;line-height:1.55;font-weight:400}
  .primary,.secondary{padding:10px 15px;font-size:13px;font-weight:700;line-height:1.5}
  .primary{background:#18372f;color:white;border:1px solid #18372f}.secondary{border:1px solid #cfcfc4;background:white;color:#18372f}
  button:disabled{opacity:.45;cursor:not-allowed}.link{color:#a95739;font-size:13px;font-weight:700;text-decoration:underline;text-underline-offset:3px}
  table{width:100%;text-align:left;font-size:13px}th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#68756d;font-weight:700}th,td{padding:14px 10px;border-bottom:1px solid #e5e2db;vertical-align:top}
  .badge{display:inline-block;padding:4px 8px;background:#f0ede6;color:#675b46;font-size:11px;text-transform:capitalize;white-space:nowrap}.badge.subscribed{background:#e4eee4;color:#24583b}
  @media(max-width:640px){.panel{padding:18px}}
</style>
