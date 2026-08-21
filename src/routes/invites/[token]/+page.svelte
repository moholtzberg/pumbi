<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { signIn } from '@auth/sveltekit/client';

  let invitation = $state(null);
  let session = $state(null);
  let loading = $state(true);
  let accepting = $state(false);
  let signingIn = $state(false);
  let accepted = $state(false);
  let message = $state('');
  let email = $state('');
  let password = $state('');

  const token = $derived($page.params.token);
  const roleLabel = $derived(invitation?.role?.replaceAll('_', ' ').toLowerCase());

  async function responseMessage(response, fallback) {
    const body = await response.json().catch(() => ({}));
    return body.message || fallback;
  }

  async function loadInvitation() {
    loading = true;
    message = '';
    const [inviteResponse, sessionResponse] = await Promise.all([
      fetch(`/api/invites/${encodeURIComponent(token)}`),
      fetch('/auth/session')
    ]);

    session = sessionResponse.ok ? await sessionResponse.json() : null;
    if (!inviteResponse.ok) {
      message = await responseMessage(inviteResponse, 'This invitation is invalid or no longer available.');
      loading = false;
      return;
    }

    invitation = await inviteResponse.json();
    email = invitation.email;
    loading = false;
  }

  async function handleSignIn(event) {
    event.preventDefault();
    signingIn = true;
    message = '';
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false
    });

    if (result?.error) {
      message = 'Invalid email or password.';
      signingIn = false;
      return;
    }

    const sessionResponse = await fetch('/auth/session');
    session = sessionResponse.ok ? await sessionResponse.json() : null;
    if (!session?.user) message = 'Sign-in did not complete. Please try again.';
    signingIn = false;
  }

  async function acceptInvitation() {
    accepting = true;
    message = '';
    const response = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
      method: 'POST'
    });

    if (!response.ok) {
      message = await responseMessage(response, 'Could not accept the invitation.');
      accepting = false;
      return;
    }

    accepted = true;
    accepting = false;
  }

  onMount(loadInvitation);
</script>

<svelte:head>
  <title>Auction house invitation</title>
</svelte:head>

<main class="min-h-screen bg-[#f7f4ee] px-4 py-12">
  <div class="mx-auto max-w-lg rounded-lg bg-white p-8 shadow">
    {#if loading}
      <p class="text-center text-gray-600">Loading invitation…</p>
    {:else if accepted}
      <div class="text-center">
        <h1 class="text-2xl font-bold text-gray-900">Invitation accepted</h1>
        <p class="mt-3 text-gray-600">You are now a member of {invitation.auctionHouseName}.</p>
        <button
          class="mt-6 rounded-md bg-[#18372f] px-4 py-2 font-medium text-white hover:bg-[#152c26]"
          onclick={() => goto('/dashboard')}
        >
          Continue to dashboard
        </button>
      </div>
    {:else if invitation}
      <h1 class="text-2xl font-bold text-gray-900">Join {invitation.auctionHouseName}</h1>
      <p class="mt-3 text-gray-600">
        {invitation.firstName} {invitation.lastName}, you were invited as
        <span class="font-medium capitalize">{roleLabel}</span>.
      </p>
      <dl class="mt-6 rounded-md bg-[#f7f4ee] p-4 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-gray-500">Invited email</dt>
          <dd class="font-medium text-gray-900">{invitation.email}</dd>
        </div>
        <div class="mt-2 flex justify-between gap-4">
          <dt class="text-gray-500">Expires</dt>
          <dd class="font-medium text-gray-900">
            {new Date(invitation.expiresAt).toLocaleString()}
          </dd>
        </div>
      </dl>

      {#if message}
        <p class="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{message}</p>
      {/if}

      {#if session?.user}
        <p class="mt-6 text-sm text-gray-600">
          Signed in as <span class="font-medium">{session.user.email}</span>
        </p>
        <button
          class="mt-3 w-full rounded-md bg-[#18372f] px-4 py-2 font-medium text-white hover:bg-[#152c26] disabled:opacity-50"
          disabled={accepting}
          onclick={acceptInvitation}
        >
          {accepting ? 'Accepting…' : 'Accept invitation'}
        </button>
      {:else}
        <form class="mt-6 space-y-4" onsubmit={handleSignIn}>
          <h2 class="font-semibold text-gray-900">Sign in to accept</h2>
          <div>
            <label class="block text-sm font-medium text-gray-700" for="email">Email</label>
            <input
              id="email"
              class="mt-1 block w-full rounded-md border-gray-300"
              type="email"
              autocomplete="email"
              required
              bind:value={email}
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700" for="password">Password</label>
            <input
              id="password"
              class="mt-1 block w-full rounded-md border-gray-300"
              type="password"
              autocomplete="current-password"
              required
              bind:value={password}
            />
          </div>
          <button
            class="w-full rounded-md bg-[#18372f] px-4 py-2 font-medium text-white hover:bg-[#152c26] disabled:opacity-50"
            disabled={signingIn}
            type="submit"
          >
            {signingIn ? 'Signing in…' : 'Sign in'}
          </button>
          <p class="text-center text-sm text-gray-600">
            Need an account?
            <a
              class="font-medium text-[#18372f] hover:text-[#a95739]"
              href={`/auth/register?redirect=${encodeURIComponent(`/invites/${token}`)}`}
            >Register</a>
          </p>
        </form>
      {/if}
    {:else}
      <h1 class="text-center text-2xl font-bold text-gray-900">Invitation unavailable</h1>
      {#if message}
        <p class="mt-4 text-center text-gray-600">{message}</p>
      {/if}
    {/if}
  </div>
</main>
