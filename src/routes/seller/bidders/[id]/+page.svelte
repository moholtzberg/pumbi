<script>
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  let { data, form } = $props();
  let saving = $state(false);
  let profile = $derived(data.profile);
  let user = $derived(profile.user);
  let blocked = $derived(Boolean(profile.block?.active));
  let paidCount = $derived(profile.summary.balances.reduce((sum, row) => sum + row.paidInvoices, 0));
  let unpaidCount = $derived(profile.summary.balances.reduce((sum, row) => sum + row.unpaidInvoices, 0));
  const date = value => value ? new Date(value).toLocaleString() : '—';
  const label = value => String(value || '').replaceAll('_', ' ').toLowerCase();
  function money(value, currency = 'USD') {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(Number(value || 0)); }
    catch { return `${currency} ${value}`; }
  }
  function paginationHref(key, value) {
    const params = new URLSearchParams($page.url.searchParams);
    for (const param of [...params.keys()]) if (param.startsWith('/')) params.delete(param);
    params.set('houseId', data.bidderHouse.id); params.set(key, String(value));
    return `${$page.url.pathname}?${params}`;
  }
  function submitting() { saving = true; return async ({ update }) => { try { await update(); } finally { saving = false; } }; }
</script>

{#snippet pages(key, current, total)}
  <nav class="mt-4 flex items-center justify-between gap-3 text-sm" aria-label={`${key} pages`}>
    <a href={paginationHref(key, Math.max(1,current - 1))} class:pointer-events-none={current <= 1} class:opacity-40={current <= 1} aria-disabled={current <= 1}>← Previous</a>
    <span>Page {current} of {Math.max(1,Math.ceil(total / profile.pagination.pageSize))}</span>
    <a href={paginationHref(key,current + 1)} class:pointer-events-none={current * profile.pagination.pageSize >= total} class:opacity-40={current * profile.pagination.pageSize >= total} aria-disabled={current * profile.pagination.pageSize >= total}>Next →</a>
  </nav>
{/snippet}

<svelte:head><title>{user.name || user.email} · Bidder profile | Pumbi</title></svelte:head>
<main class="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
  <header class="flex flex-wrap items-start justify-between gap-4"><div><a class="text-sm font-semibold text-[#a95739]" href={`/seller/bidders?houseId=${encodeURIComponent(data.bidderHouse.id)}`}>← All house bidders</a><p class="pumbi-eyebrow mt-5">{data.bidderHouse.name} · Bidder profile</p><h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-4xl font-semibold">{user.name || [user.firstName,user.lastName].filter(Boolean).join(' ') || user.email}</h1><p class="mt-3 text-sm text-[var(--pumbi-ink-soft)]">Participation and payment history with your auction house.</p></div><span class="badge mt-7" class:danger={blocked}>{blocked ? 'Blocked from house auctions' : 'Not blocked'}</span></header>
  {#if form?.error}<p role="alert" class="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{form.error}</p>{/if}
  {#if form?.message}<p role="status" class="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{form.message}</p>{/if}

  <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
    {#each [['Auctions',profile.summary.auctionCount],['Lots bid on',profile.summary.lotsBidOn],['Lots won',profile.summary.lotsWon],['Paid invoices',paidCount],['Unpaid invoices',unpaidCount]] as stat}<div class="pumbi-panel p-5"><p class="text-xs font-bold uppercase tracking-wider text-[var(--pumbi-muted)]">{stat[0]}</p><p class="mt-2 text-3xl font-semibold">{stat[1]}</p></div>{/each}
  </div>

  <div class="grid items-start gap-6 lg:grid-cols-2">
    <section class="pumbi-panel space-y-4 p-6"><h2>Contact details</h2><dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-sm"><dt>Email</dt><dd class="break-words">{user.email}</dd><dt>Phone</dt><dd>{user.phone || 'Not provided'}</dd><dt>Address</dt><dd class="whitespace-pre-wrap">{user.address || 'Not provided'}</dd><dt>Account created</dt><dd>{date(user.createdAt)}</dd><dt>Buyer verification</dt><dd>{user.isVerifiedBuyer ? 'Complete' : 'Not complete'}</dd><dt>Bid events</dt><dd>{profile.summary.bidCount} (including automatic responses)</dd></dl><p class="hint">Open auctions allow signed-in bidders without buyer verification. A house block applies to every auction regardless of its registration setting.</p></section>
    <section class="pumbi-panel space-y-4 p-6"><h2>House bidding access</h2><p class="hint">Blocking prevents new online bids, phone bids, and automatic maximum-bid responses in all auctions at {data.bidderHouse.name}. Existing bids, wins, and invoices remain in the history.</p>
      {#if blocked}
        <div class="border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p class="font-bold">Blocked {date(profile.block.blockedAt)}</p><p class="mt-2 whitespace-pre-wrap">{profile.block.reason}</p><p class="mt-2 text-xs">By {profile.block.blockedBy?.name || profile.block.blockedBy?.email || 'house administrator'}</p></div>
        <p class="hint">Unblocking restores access under each auction’s rules. Previously submitted maximums may respond again while the lot is live.</p>
        <form method="POST" action={`?/unblock&houseId=${encodeURIComponent(data.bidderHouse.id)}`} use:enhance={submitting}><button disabled={saving} class="pumbi-btn-secondary">{saving ? 'Saving…' : 'Unblock bidder'}</button></form>
      {:else}
        {#if profile.block?.unblockedAt}<p class="hint">Last unblocked {date(profile.block.unblockedAt)} by {profile.block.unblockedBy?.name || profile.block.unblockedBy?.email || 'house administrator'}.</p>{/if}
        <form method="POST" action={`?/block&houseId=${encodeURIComponent(data.bidderHouse.id)}`} use:enhance={submitting} class="space-y-3"><label class="block text-sm font-semibold">Internal block reason<textarea name="reason" required maxlength="2000" rows="3" class="mt-2 w-full rounded-sm border border-gray-300 bg-white p-3 text-sm font-normal" placeholder="Explain why this bidder should not be allowed to bid with your house."></textarea></label><p class="hint">Only your house’s owners and admins can see this reason or change the block.</p><button disabled={saving} class="bg-red-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Block from all house auctions'}</button></form>
      {/if}
    </section>
  </div>

  <section class="pumbi-panel space-y-4 p-6"><h2>Payments & outstanding balances</h2><p class="hint">Amounts include buyer premiums and recorded shipping. Refunded and cancelled invoices are excluded from paid and outstanding totals. Currencies are kept separate.</p>
    {#if !profile.summary.balances.length}<p class="text-sm text-[var(--pumbi-muted)]">No invoices recorded for this bidder at your house yet.</p>{/if}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{#each profile.summary.balances as balance}<div class="border border-[var(--pumbi-line)] bg-white/60 p-5"><p class="text-xs font-bold uppercase text-[var(--pumbi-muted)]">{balance.currency}</p><p class="mt-3 text-sm">Received <strong class="ml-2 text-lg text-emerald-800">{money(balance.paid,balance.currency)}</strong></p><p class="mt-2 text-sm">Outstanding <strong class="ml-2 text-lg text-red-800">{money(balance.outstanding,balance.currency)}</strong></p><p class="mt-3 text-xs text-[var(--pumbi-muted)]">Refunded {money(balance.refunded,balance.currency)} · Cancelled {money(balance.cancelled,balance.currency)}</p></div>{/each}</div>
  </section>

  <section class="pumbi-panel p-6"><h2>Auction participation</h2><p class="hint">Includes registrations, actual bids, wins, and invoices from your house, including open auctions with no registration record.</p><div class="mt-4 overflow-x-auto"><table><thead><tr><th>Auction</th><th>Status</th><th>Registration</th><th>Bid events</th><th>Won</th><th>Invoices paid / unpaid</th></tr></thead><tbody>{#each profile.auctions as auction}<tr><td><a class="name-link" href={`/seller/auctions/${auction.id}`}>{auction.title}</a><p class="hint">{date(auction.startDate)}</p></td><td class="capitalize">{label(auction.status)}</td><td class="capitalize">{auction.registrationStatus ? label(auction.registrationStatus) : 'No registration'}</td><td>{auction.bidCount}</td><td>{auction.lotsWon}</td><td><span class="text-emerald-800">{auction.paidInvoices}</span> / <span class="text-red-800">{auction.unpaidInvoices}</span></td></tr>{:else}<tr><td colspan="6" class="empty">No participation records.</td></tr>{/each}</tbody></table></div>{@render pages('auctionPage',profile.pagination.auctionPage,profile.summary.auctionCount)}</section>

  <section class="pumbi-panel p-6"><h2>Lots won</h2><div class="mt-4 overflow-x-auto"><table><thead><tr><th>Lot</th><th>Auction</th><th>Hammer price</th><th>Invoice</th><th>Payment</th></tr></thead><tbody>{#each profile.wins as lot}<tr><td><a class="name-link" href={`/lots/${lot.id}`}>#{lot.lotNumber} · {lot.title}</a></td><td><a href={`/seller/auctions/${lot.auction.id}`}>{lot.auction.title}</a></td><td>{money(lot.currentBid,lot.invoice?.currency || 'USD')}</td><td>{lot.invoice?.number || 'Invoice pending'}</td><td class="capitalize">{lot.invoice ? label(lot.invoice.status) : 'Not yet invoiced'}</td></tr>{:else}<tr><td colspan="5" class="empty">No won lots at this house.</td></tr>{/each}</tbody></table></div>{@render pages('winPage',profile.pagination.winPage,profile.summary.lotsWon)}</section>

  <section class="pumbi-panel p-6"><div class="flex flex-wrap justify-between gap-3"><h2>Invoice history</h2><a class="name-link self-center text-sm" href="/seller/sold">Manage payments in Sold →</a></div><div class="mt-4 overflow-x-auto"><table><thead><tr><th>Invoice / lot</th><th>Auction</th><th>Total</th><th>Status</th><th>Payment method</th><th>Paid date</th></tr></thead><tbody>{#each profile.invoices as invoice}<tr><td><strong>{invoice.number}</strong><p class="mt-1 text-xs"><a href={`/lots/${invoice.lot.id}`}>#{invoice.lot.lotNumber} · {invoice.lot.title}</a></p></td><td><a href={`/seller/auctions/${invoice.auction.id}`}>{invoice.auction.title}</a></td><td>{money(invoice.totalAmount,invoice.currency)}</td><td><span class="badge" class:danger={['UNPAID','AWAITING_EXTERNAL','PENDING_CHECKOUT'].includes(invoice.status)}>{label(invoice.status)}</span></td><td class="capitalize">{invoice.externalPaymentMethod || (invoice.paymentChannel ? label(invoice.paymentChannel) : '—')}</td><td>{date(invoice.paidAt)}</td></tr>{:else}<tr><td colspan="6" class="empty">No invoices at this house.</td></tr>{/each}</tbody></table></div>{@render pages('invoicePage',profile.pagination.invoicePage,profile.summary.invoiceCount)}</section>
</main>
<style>
  h2{font:600 1.6rem var(--pumbi-serif),Georgia,serif}.hint{margin-top:6px;color:var(--pumbi-muted);font-size:12px;line-height:1.7}dt{color:var(--pumbi-muted)}dd{min-width:0}
  table{width:100%;text-align:left;font-size:13px}th,td{border-bottom:1px solid var(--pumbi-line);padding:14px 10px;vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--pumbi-muted)}.name-link{font-weight:600;color:#18372f;text-decoration:underline;text-underline-offset:4px}.empty{padding:32px;text-align:center;color:var(--pumbi-muted)}.badge{display:inline-block;padding:6px 10px;background:#e8eee9;color:#18372f;font-size:11px;font-weight:700;text-transform:capitalize}.badge.danger{background:#fef2f2;color:#991b1b}
</style>
