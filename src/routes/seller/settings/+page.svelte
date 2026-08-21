<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import BannerGenerator from '$lib/components/BannerGenerator.svelte';
  import { getImageUrl } from '$lib/utils/imageUrl.js';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';

  let session = $state(null);
  let currentUser = $state(null);
  let auctionHouse = $state(null);
  let auctionHouseLogoUrl = $state(null);
  let loading = $state(true);
  let saving = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  let activeTab = $state('general');
  let expandedSections = $state({});

  // Default bid increments
  const defaultBidIncrements = [
    { from: 0, increment: 5 },
    { from: 50, increment: 10 },
    { from: 200, increment: 20 },
    { from: 500, increment: 50 },
    { from: 1000, increment: 100 },
    { from: 2000, increment: 200 },
    { from: 5000, increment: 500 },
    { from: 10000, increment: 1000 },
    { from: 20000, increment: 2000 },
    { from: 50000, increment: 5000 },
    { from: 100000, increment: 10000 },
    { from: 200000, increment: 20000 },
    { from: 500000, increment: 50000 },
    { from: 1000000, increment: 100000 },
    { from: 2000000, increment: 200000 },
    { from: 5000000, increment: 500000 },
    { from: 10000000, increment: 1000000 },
    { from: 20000000, increment: 2000000 },
    { from: 50000000, increment: 5000000 },
    { from: 100000000, increment: 10000000 },
  ];

  let settings = $state({
    // Basic Information
    mainLanguage: '',
    nameInEnglish: '',
    addressInEnglish: '',
    disclaimerInEnglish: '',
    
    // Contact Information
    email: '',
    phone: '',
    phoneForWhatsapp: '',
    
    // Localization
    secondLanguage: '',
    defaultCurrency: 'USD',
    secondCurrency: '',
    
    // Pricing
    defaultItemStartPrice: null,
    buyersPremium: 0,
    addVat: false,
    
    // Email Notifications
    emailOnAbsenteeBid: false,
    emailOnAbsenteeBidCancel: false,
    emailToNotifyBidsUpdate: '',
    
    // Bidding Rules
    russianUsersRequireApproval: false,
    automaticAuctionInitialTimerSeconds: null,
    automaticAuctionTimerResetSeconds: null,
    
    // Payment Methods
    paymentMethods: [
      { method: 'Credit card', percentage: 0, vat: false },
      { method: 'PayPal', percentage: 0, vat: false },
      { method: 'Bank transfer', percentage: 0, vat: false },
    ],
    addPaymentButtonToInvoices: false,
    
    // Legal Documents
    termsOfSaleInEnglish: '',
    privacyPolicyInEnglish: '',
    disclaimerForSellersInEnglish: '',
    
    // Bid Increments
    bidIncrements: defaultBidIncrements,
    
    // Email Templates
    emailSignatureInEnglish: '',
    photoIdRequestEmailTemplateInEnglish: '',
    bidLimitEmailTemplateInEnglish: '',
    
    // Invoice Settings
    additionalTextForInvoicesInEnglish: '',
    additionalTextForConsignorStatementsInEnglish: '',
    taxNumber: '',
    invoiceProvider: 'None',
    categoryMetaFields: {},
    
    // AI Settings
    aiPrompt: ''
  });
  
  let editingCategory = $state(null);
  let newCategoryName = $state('');
  let availableCategories = $state([]);

  function toggleSection(section) {
    expandedSections[section] = !expandedSections[section];
  }
  
  async function loadAvailableCategories() {
    try {
      if (!auctionHouse?.id) return;
      const res = await fetch(`/api/categories?auctionHouseId=${auctionHouse.id}`);
      if (res.ok) {
        availableCategories = await res.json();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }
  
  function addMetaField(category) {
    if (!settings.categoryMetaFields[category]) {
      settings.categoryMetaFields[category] = [];
    }
    settings.categoryMetaFields[category].push({
      key: `field_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      options: [],
      placeholder: '',
      helpText: ''
    });
  }
  
  function removeMetaField(category, index) {
    settings.categoryMetaFields[category].splice(index, 1);
    if (settings.categoryMetaFields[category].length === 0) {
      delete settings.categoryMetaFields[category];
    }
  }
  
  function addCategory() {
    if (newCategoryName.trim() && !settings.categoryMetaFields[newCategoryName.trim()]) {
      settings.categoryMetaFields[newCategoryName.trim()] = [];
      newCategoryName = '';
    }
  }
  
  function removeCategory(category) {
    delete settings.categoryMetaFields[category];
  }

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
      errorMessage = '';

      let userResponse = await fetch(`/api/users?email=${encodeURIComponent(session.user.email)}`);
      if (!userResponse.ok) {
        errorMessage = 'User account not found.';
        loading = false;
        return;
      }
      currentUser = await userResponse.json();

      if (!currentUser.auctionHouseId) {
        errorMessage = 'You need to register an auction house first.';
        loading = false;
        return;
      }

      const auctionHouseResponse = await fetch(`/api/auction-houses?id=${currentUser.auctionHouseId}`);
      if (auctionHouseResponse.ok) {
        auctionHouse = await auctionHouseResponse.json();
        // Convert logo URL to presigned URL if it's an S3 key
        if (auctionHouse?.logoUrl) {
          auctionHouseLogoUrl = await getImageUrl(auctionHouse.logoUrl);
        }
        
        // Load existing settings
        const settingsResponse = await fetch(`/api/auction-houses/${auctionHouse.id}/settings`);
        if (settingsResponse.ok) {
          const existingSettings = await settingsResponse.json();
          // Merge with defaults, preserving existing values
          settings = { ...settings, ...existingSettings };
          if (!settings.categoryMetaFields) {
            settings.categoryMetaFields = {};
          }
          await loadAvailableCategories();
          // Ensure bid increments array exists
          if (!settings.bidIncrements || settings.bidIncrements.length === 0) {
            settings.bidIncrements = defaultBidIncrements;
          }
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      errorMessage = 'Error loading your account data. Please try again.';
    } finally {
      loading = false;
    }
  }

  function addBidIncrement() {
    settings.bidIncrements = [...settings.bidIncrements, { from: 0, increment: 0 }];
  }

  function removeBidIncrement(index) {
    settings.bidIncrements = settings.bidIncrements.filter((_, i) => i !== index);
  }

  function addPaymentMethod() {
    settings.paymentMethods = [...settings.paymentMethods, { method: '', percentage: 0, vat: false }];
  }

  function removePaymentMethod(index) {
    settings.paymentMethods = settings.paymentMethods.filter((_, i) => i !== index);
  }

  async function saveSettings() {
    try {
      saving = true;
      errorMessage = '';
      successMessage = '';

      const response = await fetch(`/api/auction-houses/${auctionHouse.id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save settings');
      }

      successMessage = 'Settings saved successfully!';
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      errorMessage = error.message || 'Failed to save settings. Please try again.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Auction House Settings</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-6">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {#if loading}
      <div class="text-center py-12">
        <PumbiLoader size="lg" label="Loading" />
        <p class="mt-4 text-gray-600">Loading settings...</p>
      </div>
    {:else if errorMessage && !auctionHouse}
      <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p class="text-red-800">{errorMessage}</p>
        <a href="/auction-houses/signup" class="text-blue-600 hover:underline mt-2 inline-block">
          Register an auction house
        </a>
      </div>
    {:else}
      <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold text-white">Auction House Settings</h1>
              {#if auctionHouse}
                <div class="mt-2 text-blue-100 text-sm">
                  <span class="font-semibold">{auctionHouse.name}</span>
                  <span class="mx-2">•</span>
                  <span class="font-mono bg-blue-800 px-2 py-0.5 rounded">{auctionHouse.slug}</span>
                </div>
              {/if}
            </div>
            <button
              onclick={saveSettings}
              disabled={saving}
              class="bg-white text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {#if errorMessage}
          <div class="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4">
            <p class="text-red-800 text-sm">{errorMessage}</p>
          </div>
        {/if}

        {#if successMessage}
          <div class="bg-green-50 border-l-4 border-green-400 p-4 mx-6 mt-4">
            <p class="text-green-800 text-sm">{successMessage}</p>
          </div>
        {/if}

        <!-- Tabs -->
        <div class="border-b border-gray-200">
          <nav class="flex -mb-px">
              <button
              onclick={() => activeTab = 'general'}
              class="px-6 py-4 text-sm font-medium border-b-2 transition-colors {activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              General
            </button>
            <button
              onclick={() => activeTab = 'metaFields'}
              class="px-6 py-4 text-sm font-medium border-b-2 transition-colors {activeTab === 'metaFields' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Category Meta Fields
            </button>
            <button
              onclick={() => activeTab = 'pricing'}
              class="px-6 py-4 text-sm font-medium border-b-2 transition-colors {activeTab === 'pricing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Pricing & Payments
            </button>
            <button
              onclick={() => activeTab = 'legal'}
              class="px-6 py-4 text-sm font-medium border-b-2 transition-colors {activeTab === 'legal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Legal & Documents
            </button>
            <button
              onclick={() => activeTab = 'email'}
              class="px-6 py-4 text-sm font-medium border-b-2 transition-colors {activeTab === 'email' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Email & Notifications
            </button>
            <button
              onclick={() => activeTab = 'advanced'}
              class="px-6 py-4 text-sm font-medium border-b-2 transition-colors {activeTab === 'advanced' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Advanced
            </button>
            <button
              onclick={() => activeTab = 'ai'}
              class="px-6 py-4 text-sm font-medium border-b-2 transition-colors {activeTab === 'ai' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              AI Settings
            </button>
            <button
              onclick={() => activeTab = 'banner'}
              class="px-6 py-4 text-sm font-medium border-b-2 transition-colors {activeTab === 'banner' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Banner
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <form onsubmit={(e) => { e.preventDefault(); saveSettings(); }} class="p-6">
          <!-- General Tab -->
          {#if activeTab === 'general'}
            <div class="space-y-4">
              <!-- Basic Information -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('basic')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Basic Information</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.basic ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.basic}
                  <div class="p-4 space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Main Language</label>
                        <input type="text" bind:value={settings.mainLanguage} placeholder="e.g., English" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name in English</label>
                        <input type="text" bind:value={settings.nameInEnglish} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Address in English</label>
                        <textarea bind:value={settings.addressInEnglish} rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                      </div>
                      <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Disclaimer in English</label>
                        <textarea bind:value={settings.disclaimerInEnglish} rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Logo -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('logo')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Logo</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.logo ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.logo}
                  <div class="p-4 space-y-4">
                    {#if auctionHouse?.logoUrl}
                      <div class="flex items-center gap-4">
                        <div>
                          <p class="text-sm font-medium text-gray-700 mb-2">Current Logo</p>
                          <img src={auctionHouseLogoUrl || auctionHouse.logoUrl} alt="Auction House Logo" class="h-24 w-24 object-contain border border-gray-200 rounded-lg p-2 bg-white" />
                        </div>
                        <div class="flex-1">
                          <p class="text-sm text-gray-600 mb-2">Logo URL:</p>
                          <input 
                            type="text" 
                            value={auctionHouse.logoUrl} 
                            readonly
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                          />
                        </div>
                      </div>
                    {:else}
                      <p class="text-sm text-gray-600">No logo uploaded yet.</p>
                    {/if}
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Upload New Logo</label>
                      <input
                        type="file"
                        accept="image/*"
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onchange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          try {
                            const formData = new FormData();
                            formData.append('files', file);
                            
                            const uploadResponse = await fetch('/api/upload/image', {
                              method: 'POST',
                              body: formData
                            });
                            
                            if (!uploadResponse.ok) {
                              throw new Error('Failed to upload logo');
                            }
                            
                            const { images } = await uploadResponse.json();
                            if (images && images.length > 0) {
                              // Store the S3 key (not a presigned URL, as those expire)
                              const logoUrl = images[0].url;
                              
                              // Update auction house logo URL
                              const updateResponse = await fetch(`/api/auction-houses/${auctionHouse.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ logoUrl })
                              });
                              
                              if (updateResponse.ok) {
                                const updated = await updateResponse.json();
                                if (updated.auctionHouse) {
                                  auctionHouse.logoUrl = updated.auctionHouse.logoUrl;
                                  // Convert to presigned URL for display
                                  if (updated.auctionHouse.logoUrl) {
                                    auctionHouseLogoUrl = await getImageUrl(updated.auctionHouse.logoUrl);
                                  } else {
                                    auctionHouseLogoUrl = null;
                                  }
                                  successMessage = 'Logo uploaded successfully!';
                                  setTimeout(() => {
                                    successMessage = '';
                                  }, 3000);
                                }
                              } else {
                                throw new Error('Failed to save logo URL');
                              }
                            }
                            
                            e.target.value = '';
                          } catch (error) {
                            console.error('Error uploading logo:', error);
                            errorMessage = error.message || 'Failed to upload logo. Please try again.';
                            setTimeout(() => {
                              errorMessage = '';
                            }, 5000);
                          }
                        }}
                      />
                      <p class="mt-1 text-xs text-gray-500">Upload an image file (PNG, JPG, SVG, etc.) to use as your auction house logo.</p>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Or Enter Logo URL</label>
                      <div class="flex gap-2">
                        <input
                          type="url"
                          id="logo-url-input"
                          placeholder="https://example.com/logo.png"
                          class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onclick={async () => {
                            const input = document.getElementById('logo-url-input');
                            const logoUrl = input?.value?.trim();
                            if (!logoUrl) {
                              errorMessage = 'Please enter a logo URL';
                              setTimeout(() => {
                                errorMessage = '';
                              }, 3000);
                              return;
                            }
                            
                            try {
                              const updateResponse = await fetch(`/api/auction-houses/${auctionHouse.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ logoUrl })
                              });
                              
                              if (updateResponse.ok) {
                                const updated = await updateResponse.json();
                                if (updated.auctionHouse) {
                                  auctionHouse.logoUrl = updated.auctionHouse.logoUrl;
                                  // Convert to presigned URL for display
                                  if (updated.auctionHouse.logoUrl) {
                                    auctionHouseLogoUrl = await getImageUrl(updated.auctionHouse.logoUrl);
                                  } else {
                                    auctionHouseLogoUrl = null;
                                  }
                                  if (input) input.value = '';
                                  successMessage = 'Logo URL saved successfully!';
                                  setTimeout(() => {
                                    successMessage = '';
                                  }, 3000);
                                }
                              } else {
                                throw new Error('Failed to save logo URL');
                              }
                            } catch (error) {
                              console.error('Error saving logo URL:', error);
                              errorMessage = error.message || 'Failed to save logo URL. Please try again.';
                              setTimeout(() => {
                                errorMessage = '';
                              }, 5000);
                            }
                          }}
                          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Save URL
                        </button>
                      </div>
                    </div>
                    
                    {#if auctionHouse?.logoUrl}
                      <div>
                        <button
                          type="button"
                          onclick={async () => {
                            if (!confirm('Are you sure you want to remove the logo?')) return;
                            
                            try {
                              const updateResponse = await fetch(`/api/auction-houses/${auctionHouse.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ logoUrl: null })
                              });
                              
                              if (updateResponse.ok) {
                                auctionHouse.logoUrl = null;
                                auctionHouseLogoUrl = null;
                                successMessage = 'Logo removed successfully!';
                                setTimeout(() => {
                                  successMessage = '';
                                }, 3000);
                              } else {
                                throw new Error('Failed to remove logo');
                              }
                            } catch (error) {
                              console.error('Error removing logo:', error);
                              errorMessage = error.message || 'Failed to remove logo. Please try again.';
                              setTimeout(() => {
                                errorMessage = '';
                              }, 5000);
                            }
                          }}
                          class="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                        >
                          Remove Logo
                        </button>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Contact Information -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('contact')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Contact Information</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.contact ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.contact}
                  <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" bind:value={settings.email} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input type="tel" bind:value={settings.phone} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Phone for WhatsApp</label>
                        <input type="tel" bind:value={settings.phoneForWhatsapp} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Localization -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('localization')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Localization</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.localization ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.localization}
                  <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Second Language</label>
                        <input type="text" bind:value={settings.secondLanguage} placeholder="e.g., Hebrew" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
                        <input type="text" bind:value={settings.defaultCurrency} placeholder="USD" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Second Currency</label>
                        <input type="text" bind:value={settings.secondCurrency} placeholder="ILS" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Pricing & Payments Tab -->
          {#if activeTab === 'pricing'}
            <div class="space-y-4">
              <!-- Pricing -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('pricing')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Pricing Settings</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.pricing ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.pricing}
                  <div class="p-4 space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Default Item Start Price</label>
                        <input type="number" bind:value={settings.defaultItemStartPrice} step="0.01" min="0" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Buyer's Premium (%)</label>
                        <input type="number" bind:value={settings.buyersPremium} step="0.01" min="0" max="100" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div class="md:col-span-2">
                        <label class="flex items-center">
                          <input type="checkbox" bind:checked={settings.addVat} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span class="text-sm font-medium text-gray-700">Add VAT</span>
                        </label>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Payment Methods -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('paymentMethods')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Payment Methods</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.paymentMethods ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.paymentMethods}
                  <div class="p-4 space-y-3">
                    <p class="text-xs text-gray-600 mb-3">Enter additional fees for each payment method. Use the Add button to include additional payment methods.</p>
                    {#each settings.paymentMethods as paymentMethod, index}
                      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                        <input type="text" bind:value={paymentMethod.method} placeholder="Payment method name" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        <input type="number" bind:value={paymentMethod.percentage} step="0.01" min="0" max="100" placeholder="%" class="w-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        <label class="flex items-center">
                          <input type="checkbox" bind:checked={paymentMethod.vat} class="mr-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span class="text-xs text-gray-700">VAT</span>
                        </label>
                        <button type="button" onclick={() => removePaymentMethod(index)} class="text-red-600 hover:text-red-800 text-sm px-2 py-1">Delete</button>
                      </div>
                    {/each}
                    <button type="button" onclick={addPaymentMethod} class="text-blue-600 hover:text-blue-800 text-sm px-4 py-2 border border-blue-600 rounded-md">
                      Add Payment Method
                    </button>
                    <div class="mt-3">
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={settings.addPaymentButtonToInvoices} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span class="text-sm font-medium text-gray-700">Add payment button to invoices</span>
                      </label>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Bid Increments -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('bidIncrements')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Bid Increments</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.bidIncrements ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.bidIncrements}
                  <div class="p-4">
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200 text-sm">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Increment</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Delete</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          {#each settings.bidIncrements as increment, index}
                            <tr>
                              <td class="px-3 py-2">
                                <input type="number" bind:value={increment.from} step="0.01" min="0" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                              </td>
                              <td class="px-3 py-2">
                                <input type="number" bind:value={increment.increment} step="0.01" min="0" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                              </td>
                              <td class="px-3 py-2">
                                <button type="button" onclick={() => removeBidIncrement(index)} class="text-red-600 hover:text-red-800 text-xs">Delete</button>
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                    <button type="button" onclick={addBidIncrement} class="mt-3 text-blue-600 hover:text-blue-800 text-sm px-4 py-2 border border-blue-600 rounded-md">
                      Add Increment
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Legal & Documents Tab -->
          {#if activeTab === 'legal'}
            <div class="space-y-4">
              <div class="border border-gray-200 rounded-lg">
                <div class="p-4 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Terms of Sale in English</label>
                    <textarea bind:value={settings.termsOfSaleInEnglish} rows="6" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Privacy Policy in English</label>
                    <textarea bind:value={settings.privacyPolicyInEnglish} rows="6" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Disclaimer for Sellers in English</label>
                    <textarea bind:value={settings.disclaimerForSellersInEnglish} rows="6" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Email & Notifications Tab -->
          {#if activeTab === 'email'}
            <div class="space-y-4">
              <!-- Email Notifications -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('emailNotifications')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Email Notifications</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.emailNotifications ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.emailNotifications}
                  <div class="p-4 space-y-3">
                    <label class="flex items-center">
                      <input type="checkbox" bind:checked={settings.emailOnAbsenteeBid} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                      <span class="text-sm text-gray-700">Send email when user places an absentee bid</span>
                    </label>
                    <label class="flex items-center">
                      <input type="checkbox" bind:checked={settings.emailOnAbsenteeBidCancel} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                      <span class="text-sm text-gray-700">Send email when user cancels absentee bid</span>
                    </label>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Email to notify bids update</label>
                      <input type="email" bind:value={settings.emailToNotifyBidsUpdate} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Email Templates -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('emailTemplates')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Email Templates</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.emailTemplates ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.emailTemplates}
                  <div class="p-4 space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Email Signature in English</label>
                      <textarea bind:value={settings.emailSignatureInEnglish} rows="4" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Photo ID Request Email Template</label>
                      <textarea bind:value={settings.photoIdRequestEmailTemplateInEnglish} rows="6" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Bid Limit Email Template</label>
                      <textarea bind:value={settings.bidLimitEmailTemplateInEnglish} rows="6" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Advanced Tab -->
          {#if activeTab === 'advanced'}
            <div class="space-y-4">
              <!-- Bidding Rules -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('biddingRules')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Bidding Rules</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.biddingRules ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.biddingRules}
                  <div class="p-4 space-y-4">
                    <label class="flex items-center">
                      <input type="checkbox" bind:checked={settings.russianUsersRequireApproval} class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                      <span class="text-sm font-medium text-gray-700">Russian users require special bidding approval</span>
                    </label>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Default time on block (seconds)</label>
                      <input type="number" min="1" bind:value={settings.automaticAuctionInitialTimerSeconds} placeholder="Platform default: 60" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Bid refresh threshold (seconds)</label>
                      <input type="number" min="1" bind:value={settings.automaticAuctionTimerResetSeconds} placeholder="Platform default: 30" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <p class="mt-1 text-xs text-gray-500">Auctions inherit these values unless they define their own.</p>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Invoice Settings -->
              <div class="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onclick={() => toggleSection('invoiceSettings')}
                  class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-medium text-gray-900">Invoice Settings</span>
                  <svg class="w-5 h-5 text-gray-500 transform transition-transform {expandedSections.invoiceSettings ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {#if expandedSections.invoiceSettings}
                  <div class="p-4 space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Additional Text for Invoices in English</label>
                      <textarea bind:value={settings.additionalTextForInvoicesInEnglish} rows="4" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Additional Text for Consignor Statements in English</label>
                      <textarea bind:value={settings.additionalTextForConsignorStatementsInEnglish} rows="4" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tax Number</label>
                        <input type="text" bind:value={settings.taxNumber} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Invoice Provider</label>
                        <select bind:value={settings.invoiceProvider} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="None">None</option>
                          <option value="QuickBooks">QuickBooks</option>
                          <option value="Xero">Xero</option>
                          <option value="FreshBooks">FreshBooks</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
            
            <!-- Category Meta Fields Tab -->
            {#if activeTab === 'metaFields'}
              <div class="p-6 space-y-6">
                <div class="mb-6">
                  <h2 class="text-xl font-bold text-gray-900 mb-2">Category Meta Fields Configuration</h2>
                  <p class="text-sm text-gray-600">Define custom fields for different categories. These fields will appear when creating or editing lots in the specified category.</p>
                </div>
                
                <!-- Add New Category -->
                <div class="bg-gray-50 p-4 rounded-lg mb-6">
                  <div class="flex gap-2">
                    <input
                      type="text"
                      bind:value={newCategoryName}
                      placeholder="Enter category name (e.g., Books, Art, Jewelry)"
                      class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onkeydown={(e) => { if (e.key === 'Enter') addCategory(); }}
                    />
                    <button
                      onclick={addCategory}
                      class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Add Category
                    </button>
                  </div>
                </div>
                
                <!-- Configured Categories -->
                {#each Object.entries(settings.categoryMetaFields || {}) as [category, fields]}
                  <div class="border border-gray-200 rounded-lg p-4 mb-4">
                    <div class="flex items-center justify-between mb-4">
                      <h3 class="text-lg font-semibold text-gray-900">{category}</h3>
                      <button
                        onclick={() => removeCategory(category)}
                        class="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove Category
                      </button>
                    </div>
                    
                    {#each fields as field, index}
                      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">Field Label</label>
                            <input
                              type="text"
                              bind:value={field.label}
                              placeholder="e.g., Author, Year Printed"
                              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">Field Type</label>
                            <select
                              bind:value={field.type}
                              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="boolean">Yes/No</option>
                              <option value="select">Dropdown</option>
                            </select>
                          </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">Placeholder</label>
                            <input
                              type="text"
                              bind:value={field.placeholder}
                              placeholder="Optional placeholder text"
                              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div class="flex items-center">
                            <label class="flex items-center">
                              <input
                                type="checkbox"
                                bind:checked={field.required}
                                class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span class="text-xs font-medium text-gray-700">Required field</span>
                            </label>
                          </div>
                        </div>
                        
                        {#if field.type === 'select'}
                          <div class="mb-3">
                            <label class="block text-xs font-medium text-gray-700 mb-1">Options (one per line)</label>
                            <textarea
                              value={field.options?.join('\n') || ''}
                              oninput={(e) => {
                                field.options = e.target.value.split('\n').filter(o => o.trim());
                              }}
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                              rows="3"
                              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            ></textarea>
                          </div>
                        {/if}
                        
                        <div class="mb-3">
                          <label class="block text-xs font-medium text-gray-700 mb-1">Help Text (optional)</label>
                          <input
                            type="text"
                            bind:value={field.helpText}
                            placeholder="Additional information for users"
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        <button
                          onclick={() => removeMetaField(category, index)}
                          class="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Remove Field
                        </button>
                      </div>
                    {/each}
                    
                    <button
                      onclick={() => addMetaField(category)}
                      class="w-full mt-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                    >
                      + Add Field
                    </button>
                  </div>
                {/each}
                
                {#if Object.keys(settings.categoryMetaFields || {}).length === 0}
                  <div class="text-center py-12 text-gray-500">
                    <p>No category meta fields configured yet.</p>
                    <p class="text-sm mt-2">Add a category above to get started.</p>
                  </div>
                {/if}
              </div>
            {/if}
            
            {#if activeTab === 'ai'}
              <div class="p-6 space-y-4">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 mb-4">AI Settings</h3>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      AI Prompt (Base Prompt for All Auctions)
                    </label>
                    <textarea
                      bind:value={settings.aiPrompt}
                      rows="6"
                      placeholder="Enter base context, tone, style guidelines, or information about your auction house that should be included in all AI-generated content. This will be combined with auction-specific prompts."
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-1">
                      This base prompt will be added to all AI requests for generating titles, descriptions, and summarizing notes across all auctions in this auction house. Individual auctions can add their own prompts that will be combined with this one.
                    </p>
                  </div>
                </div>
              </div>
            {/if}
            
            {#if activeTab === 'banner'}
              <div class="p-6">
                <BannerGenerator 
                  type="auctionHouse" 
                  {auctionHouse}
                  onSave={(bannerUrl) => {
                    // Save banner URL to auction house settings
                    if (settings) {
                      settings.bannerUrl = bannerUrl;
                      saveSettings();
                    }
                  }}
                />
              </div>
            {/if}

        {/if}
          </form>
      </div>
    {/if}
  </div>
</div>
