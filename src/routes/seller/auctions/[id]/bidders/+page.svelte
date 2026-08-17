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

<div class="min-h-screen bg-gray-50 py-8">
  <div class="mx-auto max-w-5xl px-4">
    <a href="/seller/auctions/{$page.params.id}/settings" class="text-sm font-semibold text-blue-700">← Auction settings</a>
    <div class="mt-4 flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-purple-700">Private auction</p>
        <h1 class="text-3xl font-bold text-gray-900">Bidder approvals</h1>
        <p class="mt-1 text-gray-600">{auction?.title || 'Auction'}</p>
      </div>
      <span class="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
        {registrations.filter((item) => item.status === 'PENDING').length} pending
      </span>
    </div>

    {#if errorMessage}
      <div class="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{errorMessage}</div>
    {/if}

    {#if loading}
      <p class="mt-8 text-gray-600">Loading registrations…</p>
    {:else if registrations.length === 0}
      <div class="mt-8 rounded-xl bg-white p-8 text-center shadow">No bidder registrations yet.</div>
    {:else}
      <div class="mt-8 space-y-4">
        {#each registrations as registration}
          <article class="rounded-xl bg-white p-6 shadow">
            <div class="flex flex-col justify-between gap-4 sm:flex-row">
              <div>
                <div class="flex items-center gap-3">
                  <h2 class="text-lg font-bold">{registration.user.name || registration.user.email}</h2>
                  <span class="rounded-full px-2 py-1 text-xs font-bold {registration.status === 'APPROVED' ? 'bg-green-100 text-green-800' : registration.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                    {registration.status}
                  </span>
                </div>
                <p class="text-sm text-gray-600">{registration.user.email}</p>
                {#if registration.user.phone}<p class="text-sm text-gray-600">{registration.user.phone}</p>{/if}
                <p class="mt-2 text-xs text-gray-500">Requested {new Date(registration.createdAt).toLocaleString()}</p>
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
</div>
