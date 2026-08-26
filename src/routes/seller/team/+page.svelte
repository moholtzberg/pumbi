<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';

  const roles = ['OWNER', 'ADMIN', 'AUCTION_MANAGER', 'CATALOG_MANAGER', 'FINANCE', 'VIEWER'];
  const memberStatuses = ['ACTIVE', 'SUSPENDED'];
  let loading = $state(true);
  let saving = $state(false);
  let auctionHouseId = $state('');
  let members = $state([]);
  let invitations = $state([]);
  let errorMessage = $state('');
  let successMessage = $state('');
  let manualInviteLink = $state('');
  let invite = $state({ firstName: '', lastName: '', email: '', role: 'VIEWER' });

  function label(value) {
    return String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function message(data, fallback) {
    return data?.message || data?.error || data?.details || fallback;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(message(data, `Request failed (${response.status})`));
    return data;
  }

  function applyTeam(data) {
    members = data.members || data.memberships || [];
    invitations = data.invitations || data.invites || [];
  }

  async function load() {
    try {
      loading = true;
      errorMessage = '';
      const session = await request('/auth/session');
      if (!session?.user?.email) {
        goto(`/auth/login?redirect=${encodeURIComponent('/seller/team')}`);
        return;
      }
      const user = await request(`/api/users?email=${encodeURIComponent(session.user.email)}`);
      auctionHouseId = user.auctionHouseId || user.auctionHouse?.id || '';
      if (!auctionHouseId) {
        goto('/auction-houses/signup');
        return;
      }
      applyTeam(await request(`/api/auction-houses/${auctionHouseId}/team`));
    } catch (error) {
      errorMessage = error.message || 'Unable to load the team.';
    } finally {
      loading = false;
    }
  }

  async function inviteMember() {
    if (!invite.firstName.trim() || !invite.lastName.trim() || !invite.email.trim()) {
      errorMessage = 'First name, last name, and email are required.';
      return;
    }
    try {
      saving = true;
      errorMessage = '';
      successMessage = '';
      manualInviteLink = '';
      const data = await request(`/api/auction-houses/${auctionHouseId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: invite.firstName.trim(),
          lastName: invite.lastName.trim(),
          email: invite.email.trim().toLowerCase(),
          role: invite.role
        })
      });
      manualInviteLink = data.inviteUrl || data.inviteLink || data.manualInviteLink || data.invitation?.inviteLink || '';
      invite = { firstName: '', lastName: '', email: '', role: 'VIEWER' };
      applyTeam(await request(`/api/auction-houses/${auctionHouseId}/team`));
      successMessage = manualInviteLink
        ? 'Invitation created. Copy the one-time link now; it will not be shown again.'
        : 'Invitation sent.';
    } catch (error) {
      errorMessage = error.message || 'Unable to create the invitation.';
    } finally {
      saving = false;
    }
  }

  async function updateMember(member, changes) {
    try {
      saving = true;
      errorMessage = '';
      await request(`/api/auction-houses/${auctionHouseId}/team`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: member.id, ...changes })
      });
      Object.assign(member, changes);
      successMessage = 'Team member updated.';
    } catch (error) {
      errorMessage = error.message || 'Unable to update this member.';
      await load();
    } finally {
      saving = false;
    }
  }

  async function updateInvitation(item, status) {
    try {
      saving = true;
      errorMessage = '';
      await request(`/api/auction-houses/${auctionHouseId}/team`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: item.id })
      });
      item.status = status;
      successMessage = status === 'REVOKED' ? 'Invitation revoked.' : 'Invitation updated.';
    } catch (error) {
      errorMessage = error.message || 'Unable to update this invitation.';
    } finally {
      saving = false;
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(manualInviteLink);
      successMessage = 'Invitation link copied.';
    } catch {
      errorMessage = 'Copy failed. Select and copy the link manually.';
    }
  }

  onMount(load);
</script>

<svelte:head><title>Seller team | Pumbi</title></svelte:head>

<main class="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
  <header class="mb-6">
    <p class="pumbi-eyebrow">Access</p>
    <h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-3xl font-semibold">Team</h1>
    <p class="mt-1 text-sm text-[var(--pumbi-ink-soft)]">Invite colleagues and control roles and account status.</p>
  </header>

  {#if errorMessage}<div class="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{errorMessage}</div>{/if}
  {#if successMessage}<div class="mb-4 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{successMessage}</div>{/if}
  {#if manualInviteLink}
    <div class="mb-4 border border-amber-300 bg-amber-50 p-5">
      <p class="font-semibold text-amber-950">Copy this one-time invitation link now</p>
      <p class="mt-1 text-sm text-amber-800">For security, this link will not be available after you leave or refresh this page.</p>
      <div class="mt-3 flex flex-col gap-2 sm:flex-row">
        <input class="min-w-0 flex-1 border border-amber-300 bg-white px-3 py-2 text-sm" readonly value={manualInviteLink} />
        <button class="pumbi-btn" type="button" onclick={copyInviteLink}>Copy link</button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="pumbi-panel p-12 text-center">
      <PumbiLoader size="md" label="Loading team" />
      <p class="mt-4 text-[var(--pumbi-muted)]">Loading team…</p>
    </div>
  {:else}
    <section class="pumbi-panel p-5 sm:p-7">
      <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Invite a team member</h2>
      <form class="mt-5 grid gap-4 md:grid-cols-4" onsubmit={(event) => { event.preventDefault(); inviteMember(); }}>
        <label><span>First name *</span><input bind:value={invite.firstName} autocomplete="given-name" required /></label>
        <label><span>Last name *</span><input bind:value={invite.lastName} autocomplete="family-name" required /></label>
        <label><span>Email *</span><input type="email" bind:value={invite.email} autocomplete="email" required /></label>
        <label><span>Role *</span><select bind:value={invite.role}>{#each roles.filter((role) => role !== 'OWNER') as role}<option value={role}>{label(role)}</option>{/each}</select></label>
        <div class="md:col-span-4 flex justify-end">
          <button class="pumbi-btn" type="submit" disabled={saving}>{saving ? 'Inviting…' : 'Create invitation'}</button>
        </div>
      </form>
    </section>

    <section class="pumbi-panel mt-6 p-5 sm:p-7">
      <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Members</h2>
      <div class="mt-5 overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-[var(--pumbi-line)] text-xs uppercase tracking-wide text-[var(--pumbi-muted)]">
            <tr><th class="px-3 py-3">Member</th><th class="px-3 py-3">Role</th><th class="px-3 py-3">Status</th></tr>
          </thead>
          <tbody class="divide-y divide-[var(--pumbi-line-soft)]">
            {#each members as member}
              <tr>
                <td class="px-3 py-4">
                  <p class="font-semibold">{member.user?.firstName || member.firstName || ''} {member.user?.lastName || member.lastName || ''}</p>
                  <p class="text-[var(--pumbi-muted)]">{member.user?.email || member.email}</p>
                </td>
                <td class="px-3 py-4">
                  <select class="field min-w-44" value={member.role} disabled={saving || member.role === 'OWNER'} onchange={(event) => updateMember(member, { role: event.currentTarget.value })}>
                    {#each roles as role}<option value={role}>{label(role)}</option>{/each}
                  </select>
                </td>
                <td class="px-3 py-4">
                  <select class="field min-w-32" value={member.status} disabled={saving || member.role === 'OWNER'} onchange={(event) => updateMember(member, { status: event.currentTarget.value })}>
                    {#each memberStatuses as status}<option value={status}>{label(status)}</option>{/each}
                  </select>
                </td>
              </tr>
            {:else}
              <tr><td colspan="3" class="px-3 py-8 text-center text-[var(--pumbi-muted)]">No members returned.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="pumbi-panel mt-6 p-5 sm:p-7">
      <h2 class="font-[family-name:var(--pumbi-serif)] text-xl font-semibold">Pending and past invitations</h2>
      <div class="mt-5 space-y-3">
        {#each invitations as item}
          <div class="flex flex-col justify-between gap-3 border border-[var(--pumbi-line)] p-4 sm:flex-row sm:items-center">
            <div>
              <p class="font-semibold">{item.firstName || ''} {item.lastName || ''} <span class="font-normal text-[var(--pumbi-muted)]">· {item.email}</span></p>
              <p class="mt-1 text-sm text-[var(--pumbi-muted)]">{label(item.role)} · {label(item.status)}{item.expiresAt ? ` · Expires ${new Date(item.expiresAt).toLocaleDateString()}` : ''}</p>
            </div>
            {#if item.status === 'PENDING'}
              <button class="text-sm font-bold text-red-800" type="button" disabled={saving} onclick={() => updateInvitation(item, 'REVOKED')}>Revoke</button>
            {/if}
          </div>
        {:else}
          <p class="border border-dashed border-[var(--pumbi-line)] p-8 text-center text-[var(--pumbi-muted)]">No invitations yet.</p>
        {/each}
      </div>
    </section>
  {/if}
</main>

<style>
  label span {
    display: block;
    margin-bottom: 0.4rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--pumbi-ink-soft);
  }
  label input,
  label select,
  .field {
    width: 100%;
    border: 1px solid var(--pumbi-line);
    background: white;
    padding: 0.65rem 0.75rem;
    color: var(--pumbi-ink);
  }
  button:disabled {
    opacity: 0.5;
  }
</style>
