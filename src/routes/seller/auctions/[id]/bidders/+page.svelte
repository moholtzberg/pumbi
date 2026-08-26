<script>
  import { page } from '$app/stores';

  let auction = $state(null);
  let registrations = $state([]);
  let loading = $state(true);
  let errorMessage = $state('');
  let actionId = $state(null);
  let rejectionReasons = $state({});

  $effect(() => {
    if ($page.params.id) load();
  });

  async function load() {
    loading = true;
    errorMessage = '';
    try {
      const [auctionResponse, registrationsResponse] = await Promise.all([
        fetch(`/api/auctions/${$page.params.id}`),
        fetch(`/api/auctions/${$page.params.id}/registrations`)
      ]);
      if (!auctionResponse.ok || !registrationsResponse.ok) {
        throw new Error('Unable to load bidder registrations');
      }
      auction = await auctionResponse.json();
      registrations = await registrationsResponse.json();
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  async function review(registration, status) {
    actionId = registration.id;
    errorMessage = '';
    try {
      const response = await fetch(`/api/auctions/${$page.params.id}/registrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: registration.id,
          status,
          rejectionReason: rejectionReasons[registration.id] || ''
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to update registration');
      registrations = registrations.map((item) => item.id === result.id ? result : item);
    } catch (error) {
      errorMessage = error.message;
    } finally {
      actionId = null;
    }
  }
</script>

<svelte:head><title>Bidder approvals</title></svelte:head>

<div>
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <p class="pumbi-eyebrow">Private auction access</p>
      <h2 class="mt-1 font-[family-name:var(--pumbi-serif)] text-2xl font-semibold">Bidder approvals</h2>
      <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">{auction?.title || 'Auction'}</p>
    </div>
    <span class="bg-[var(--pumbi-cream-deep)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--pumbi-ink)]">
      {registrations.filter((item) => item.status === 'PENDING').length} pending
    </span>
  </div>

  {#if errorMessage}
    <div class="mt-6 border border-red-200 bg-red-50 p-4 text-red-800">{errorMessage}</div>
  {/if}

  {#if loading}
    <p class="mt-8 text-[var(--pumbi-muted)]">Loading registrations…</p>
  {:else if registrations.length === 0}
    <div class="pumbi-panel mt-8 p-8 text-center text-[var(--pumbi-muted)]">No bidder registrations yet.</div>
  {:else}
    <div class="mt-8 space-y-4">
      {#each registrations as registration}
        <article class="pumbi-panel p-6">
          <div class="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <div class="flex items-center gap-3">
                <h2 class="text-lg font-semibold">{registration.user.name || registration.user.email}</h2>
                <span class="px-2 py-1 text-[10px] font-bold uppercase tracking-wide {registration.status === 'APPROVED' ? 'bg-[#e8eee9] text-[var(--pumbi-forest)]' : registration.status === 'REJECTED' ? 'bg-red-50 text-red-800' : 'bg-[var(--pumbi-cream-deep)] text-[var(--pumbi-ink)]'}">
                  {registration.status}
                </span>
              </div>
              <p class="text-sm text-[var(--pumbi-ink-soft)]">{registration.user.email}</p>
              {#if registration.user.phone}<p class="text-sm text-[var(--pumbi-ink-soft)]">{registration.user.phone}</p>{/if}
              <p class="mt-2 text-xs text-[var(--pumbi-muted)]">Requested {new Date(registration.createdAt).toLocaleString()}</p>
            </div>

              {#if registration.status === 'PENDING'}
                <div class="w-full max-w-md space-y-2">
                  <input
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Reason required when rejecting"
                    bind:value={rejectionReasons[registration.id]}
                  />
                  <div class="flex gap-2">
                    <button disabled={actionId === registration.id} onclick={() => review(registration, 'APPROVED')} class="rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Approve</button>
                    <button disabled={actionId === registration.id} onclick={() => review(registration, 'REJECTED')} class="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Reject</button>
                  </div>
                </div>
              {:else if registration.rejectionReason}
                <p class="max-w-md text-sm text-red-700">{registration.rejectionReason}</p>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    {/if}
</div>
