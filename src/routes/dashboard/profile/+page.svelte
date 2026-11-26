<script>
  import { translate } from '$lib/i18n.js';
  import { page } from '$app/stores';
  const t = (text, values) => translate($page.data.locale || 'en', text, values);

  import { legacyAddress } from '$lib/utils/addresses.js';
  import AddressBook from '$lib/components/AddressBook.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';
  
  let session = $state(null);
  let currentUser = $state(null);
  let loading = $state(true);
  let saving = $state(false);
  let addressCount = $state(0);
  let error = $state('');
  let success = $state('');
  
  let formData = $state({
    firstName: '',
    lastName: '',
    phone: '',
    country: 'US',
    address: ''
  });
  
  onMount(async () => {
    await loadSession();
    if (session?.user) {
      await loadUserData();
    } else {
      goto('/auth/login');
    }
  });
  
  async function loadSession() {
    try {
      const res = await fetch('/auth/session');
      const data = await res.json();
      session = data;
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }
  
  async function loadUserData() {
    try {
      loading = true;
      const userResponse = await fetch(`/api/users?email=${encodeURIComponent(session.user.email)}`, {
        credentials: 'include'
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to load user data');
      }
      
      currentUser = await userResponse.json();
      formData = {
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        phone: currentUser.phone || '',
        address: currentUser.address || '',
        country: currentUser.country || legacyAddress(currentUser.address).country
      };
    } catch (error) {
      console.error('Error loading user data:', error);
      error = 'Failed to load profile data';
    } finally {
      loading = false;
    }
  }
  
  async function saveProfile() {
    try {
      saving = true;
      error = '';
      success = '';
      
      const response = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          phone: formData.phone || null,
          country: formData.country,
          address: formData.address || null
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
      
      success = 'Profile updated successfully!';
      await loadUserData();
      
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      error = err.message || 'Failed to update profile';
    } finally {
      saving = false;
    }
  }
</script>

<div class="min-h-screen bg-[#f7f4ee]">
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <a href="/dashboard" class="text-[#18372f] hover:text-[#18372f] flex items-center">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          {t("Back to Dashboard")}
        </a>
      </div>
      
      <h1 class="text-3xl font-bold text-gray-900 mb-8">{t("Edit Profile")}</h1>
      
      {#if loading}
        <div class="text-center py-12">
          <PumbiLoader size="lg" label="Loading" />
          <p class="mt-4 text-gray-600">{t("Loading...")}</p>
        </div>
      {:else}
        <div class="bg-white rounded-lg shadow-lg p-6">
          {#if error}
            <div class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p class="text-red-800 text-sm">{error}</p>
            </div>
          {/if}
          
          {#if success}
            <div class="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <p class="text-green-800 text-sm font-semibold">{success}</p>
            </div>
          {/if}
          
          <form onsubmit={(e) => { e.preventDefault(); saveProfile(); }} class="space-y-6">
            <label class="mb-5 block text-sm font-semibold">{t("Country")}<select bind:value={formData.country} class="mt-2 block w-full border border-gray-300 bg-white p-3"><option value="US">{t("United States")}</option><option value="IL">{t("Israel")}</option><option value="GB">{t("United Kingdom")}</option><option value="CA">{t("Canada")}</option><option value="AU">{t("Australia")}</option><option value="DE">{t("Germany")}</option><option value="FR">{t("France")}</option>{#if !['US','IL','GB','CA','AU','DE','FR'].includes(formData.country)}<option value={formData.country}>{formData.country}</option>{/if}</select></label>
            <p class="mb-4 text-sm text-slate-600">{formData.country === 'IL' ? 'טלפון ישראלי: 050-123-4567 או ‎+972501234567. אין צורך במדינה/מחוז בכתובת ישראלית.' : 'Include your country code when entering an international phone number.'}</p>
            <div>
              <label for="firstName" class="block text-sm font-medium text-gray-700 mb-2">
                {t("First Name")} <span class="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                bind:value={formData.firstName}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="John"
              />
            </div>
            
            <div>
              <label for="lastName" class="block text-sm font-medium text-gray-700 mb-2">
                {t("Last Name")} <span class="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                bind:value={formData.lastName}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Doe"
              />
            </div>
            
            <div>
              <label for="phone" class="block text-sm font-medium text-gray-700 mb-2">
                {t("Phone Number")} <span class="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                bind:value={formData.phone}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            </div>
            
            <div>
              <label for="address" class="block text-sm font-medium text-gray-700 mb-2">
                {t("Address")} <span class="text-red-500">*</span>
              </label>
              <textarea
                id="address"
                readonly={addressCount > 0}
                rows="3"
                bind:value={formData.address}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="123 Main St, City, State, ZIP"
              ></textarea>
            </div>
            
            <div class="bg-[#efe8dc] border border-[#ddd6ca] rounded-lg p-4">
              <p class="text-sm text-[#18372f]">
                <strong>{t("Next:")}</strong> {t("After completing your profile, use Account verification to confirm your email, phone, photo ID and selfie, and a valid card.")}
              </p>
            </div>
            
            <div class="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                class="flex-1 bg-[#18372f] text-white py-3 px-6 rounded-lg hover:bg-[#152c26] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {#if saving}
                  {t("Saving...")}
                {:else}
                  {t("Save Profile")}
                {/if}
              </button>
              <a
                href="/dashboard"
                class="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors font-semibold text-center"
              >
                {t("Cancel")}
              </a>
            </div>
          </form>
          <AddressBook user={currentUser} onchanged={result => { addressCount = result.addresses.length; if (result.changed || addressCount) { formData.address = result.profileAddress; currentUser.address = result.profileAddress; } }} />
        </div>
      {/if}
    </div>
  </div>
</div>
