<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import PumbiLoader from '$lib/components/PumbiLoader.svelte';
  
  let lot = $state(null);
  let auction = $state(null);
  let loading = $state(true);
  let saving = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  
  let editedLot = $state({
    lotNumber: 1,
    title: '',
    description: '',
    category: '',
    tags: [],
    metaFields: {},
    startingBid: 0,
    bidIncrement: 100,
    status: 'active',
    endTime: '',
    initialTimerSeconds: null,
    bidExtensionSeconds: null
  });
  
  let categoryMetaFieldsConfig = $state({});
  let auctionHouseId = $state(null);
  let availableCategories = $state([]);
  let availableTags = $state([]);
  let categoryInput = $state('');
  let tagInput = $state('');
  let showCategoryDropdown = $state(false);
  let showTagDropdown = $state(false);
  let removeBackground = $state(false);
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    try {
      loading = true;
      const [lotRes, auctionRes] = await Promise.all([
        fetch(`/api/lots/${$page.params.lotId}`),
        fetch(`/api/auctions/${$page.params.id}`)
      ]);
      
      if (!lotRes.ok) {
        throw new Error('Failed to load lot');
      }
      if (!auctionRes.ok) {
        throw new Error('Failed to load auction');
      }
      
      lot = await lotRes.json();
      auction = await auctionRes.json();
      auctionHouseId = auction?.auctionHouseId;
      
      // Parse tags from JSON string if needed
      let tags = [];
      if (lot.tags) {
        try {
          tags = typeof lot.tags === 'string' ? JSON.parse(lot.tags) : lot.tags;
        } catch {
          tags = [];
        }
      }
      
      // Parse metaFields from JSON string if needed
      let metaFields = {};
      if (lot.metaFields) {
        try {
          metaFields = typeof lot.metaFields === 'string' ? JSON.parse(lot.metaFields) : lot.metaFields;
        } catch {
          metaFields = {};
        }
      }
      
      // Format endTime for datetime-local input
      let endTime = '';
      if (lot.endTime) {
        const date = new Date(lot.endTime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        endTime = `${year}-${month}-${day}T${hours}:${minutes}`;
      }
      
      editedLot = {
        lotNumber: lot.lotNumber || 1,
        title: lot.title || '',
        description: lot.description || '',
        category: lot.category || '',
        tags: tags,
        metaFields: metaFields,
        startingBid: lot.startingBid || 0,
        bidIncrement: lot.bidIncrement || 100,
        status: (lot.status || 'ACTIVE').toLowerCase(),
        endTime: endTime,
        initialTimerSeconds: lot.initialTimerSeconds ?? null,
        bidExtensionSeconds: lot.bidExtensionSeconds ?? null
      };
      
      categoryInput = editedLot.category;
      
      // Load categories and tags
      await loadCategoriesAndTags();
      
      // Load category meta fields configuration
      await loadCategoryMetaFieldsConfig();
    } catch (error) {
      console.error('Error loading data:', error);
      errorMessage = 'Failed to load lot data. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  async function loadCategoriesAndTags() {
    try {
      if (!auction?.auctionHouseId) return;
      
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch(`/api/categories?auctionHouseId=${auction.auctionHouseId}`),
        fetch(`/api/tags?auctionHouseId=${auction.auctionHouseId}`)
      ]);
      
      if (categoriesRes.ok) {
        availableCategories = await categoriesRes.json();
      }
      if (tagsRes.ok) {
        availableTags = await tagsRes.json();
      }
    } catch (error) {
      console.error('Error loading categories and tags:', error);
    }
  }
  
  async function loadCategoryMetaFieldsConfig() {
    try {
      if (!auctionHouseId) return;
      const res = await fetch(`/api/auction-houses/${auctionHouseId}/settings`);
      if (res.ok) {
        const settings = await res.json();
        categoryMetaFieldsConfig = settings.categoryMetaFields || {};
      }
    } catch (error) {
      console.error('Error loading category meta fields config:', error);
    }
  }
  
  function getMetaFieldsForCategory(category) {
    if (!category || !categoryMetaFieldsConfig[category]) {
      return [];
    }
    return categoryMetaFieldsConfig[category];
  }
  
  async function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('lotId', $page.params.lotId);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload images');
      }
      
      const { images } = await response.json();
      
      // Add uploaded images to the lot
      const imageResponse = await fetch(`/api/lots/${$page.params.lotId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: images.map((img, index) => ({
            url: img.url,
            key: img.key,
            displayOrder: index,
            isPrimary: index === 0 && (!lot.images || lot.images.length === 0)
          }))
        })
      });
      
      if (!imageResponse.ok) {
        throw new Error('Failed to save image records');
      }
      
      // Reload lot data
      await loadData();
      
      // Clear the file input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading images:', error);
      errorMessage = 'Failed to upload images. Please try again.';
    }
  }
  
  async function saveLot() {
    saving = true;
    errorMessage = '';
    successMessage = '';
    
    try {
      const response = await fetch(`/api/lots/${$page.params.lotId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lotNumber: editedLot.lotNumber,
          title: editedLot.title,
          description: editedLot.description,
          category: editedLot.category,
          tags: editedLot.tags.length > 0 ? editedLot.tags : null,
          metaFields: Object.keys(editedLot.metaFields || {}).length > 0 ? editedLot.metaFields : null,
          startingBid: editedLot.startingBid,
          bidIncrement: editedLot.bidIncrement,
          status: editedLot.status.toUpperCase(),
          endTime: editedLot.endTime || null,
          initialTimerSeconds: editedLot.initialTimerSeconds || null,
          bidExtensionSeconds: editedLot.bidExtensionSeconds || null
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update lot');
      }
      
      successMessage = 'Lot updated successfully!';
      setTimeout(() => {
        goto(`/seller/auctions/${$page.params.id}/lots`);
      }, 1500);
    } catch (error) {
      console.error('Error saving lot:', error);
      errorMessage = error.message || 'Failed to save lot. Please try again.';
    } finally {
      saving = false;
    }
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
</script>

<svelte:head>
  <title>Edit Lot - {lot?.title || 'Loading...'}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-6">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    {#if loading}
      <div class="text-center py-12">
        <PumbiLoader size="lg" label="Loading" />
        <p class="mt-4 text-gray-600">Loading lot...</p>
      </div>
    {:else if lot}
      <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Edit Lot</h1>
            <p class="text-gray-600 mt-1">Lot #{lot.lotNumber}</p>
          </div>
          <button
            onclick={() => goto(`/seller/auctions/${$page.params.id}/lots`)}
            class="text-gray-600 hover:text-gray-800"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {#if errorMessage}
          <div class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-800 text-sm">{errorMessage}</p>
          </div>
        {/if}
        
        {#if successMessage}
          <div class="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p class="text-green-800 text-sm">{successMessage}</p>
          </div>
        {/if}
        
        <form onsubmit={(e) => { e.preventDefault(); saveLot(); }}>
          <div class="space-y-6">
            <!-- Lot Number -->
            <div>
              <label for="lotNumber" class="block text-sm font-medium text-gray-700 mb-2">
                Lot Number *
              </label>
              <input
                id="lotNumber"
                type="number"
                bind:value={editedLot.lotNumber}
                required
                min="1"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <!-- Title -->
            <div>
              <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
                Lot Title *
              </label>
              <input
                id="title"
                type="text"
                bind:value={editedLot.title}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Original Oil Painting - Landscape"
              />
            </div>
            
            <!-- Description -->
            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                bind:value={editedLot.description}
                required
                rows="4"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the lot..."
              ></textarea>
            </div>
            
            <!-- Category with autocomplete -->
            <div class="relative">
              <label for="category" class="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <div class="relative">
                <input
                  id="category"
                  type="text"
                  bind:value={categoryInput}
                  oninput={() => {
                    showCategoryDropdown = categoryInput.length > 0;
                    editedLot.category = categoryInput;
                  }}
                  onfocus={() => showCategoryDropdown = categoryInput.length > 0}
                  onblur={() => setTimeout(() => showCategoryDropdown = false, 200)}
                  placeholder="Type to search or create new category"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {#if showCategoryDropdown && availableCategories.length > 0}
                  <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {#each availableCategories.filter(c => c.toLowerCase().includes(categoryInput.toLowerCase())) as cat}
                      <button
                        type="button"
                        onclick={() => {
                          categoryInput = cat;
                          editedLot.category = cat;
                          showCategoryDropdown = false;
                        }}
                        class="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm"
                      >
                        {cat}
                      </button>
                    {/each}
                    {#if categoryInput && !availableCategories.some(c => c.toLowerCase() === categoryInput.toLowerCase())}
                      <button
                        type="button"
                        onclick={() => {
                          editedLot.category = categoryInput;
                          showCategoryDropdown = false;
                        }}
                        class="w-full text-left px-4 py-2 hover:bg-green-50 text-sm text-green-600 font-semibold"
                      >
                        + Create "{categoryInput}"
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            
            <!-- Tags with autocomplete -->
            <div class="relative">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div class="flex flex-wrap gap-2 mb-2">
                {#each editedLot.tags as tag, index}
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {tag}
                    <button
                      type="button"
                      onclick={() => {
                        editedLot.tags = editedLot.tags.filter((_, i) => i !== index);
                      }}
                      class="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                {/each}
              </div>
              <div class="relative">
                <input
                  type="text"
                  bind:value={tagInput}
                  oninput={() => showTagDropdown = tagInput.length > 0}
                  onfocus={() => showTagDropdown = tagInput.length > 0}
                  onblur={() => setTimeout(() => showTagDropdown = false, 200)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      if (!editedLot.tags.includes(tagInput.trim())) {
                        editedLot.tags = [...editedLot.tags, tagInput.trim()];
                      }
                      tagInput = '';
                      showTagDropdown = false;
                    }
                  }}
                  placeholder="Type and press Enter to add tag"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {#if showTagDropdown && availableTags.length > 0}
                  <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {#each availableTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !editedLot.tags.includes(t)) as tag}
                      <button
                        type="button"
                        onclick={() => {
                          if (!editedLot.tags.includes(tag)) {
                            editedLot.tags = [...editedLot.tags, tag];
                          }
                          tagInput = '';
                          showTagDropdown = false;
                        }}
                        class="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm"
                      >
                        {tag}
                      </button>
                    {/each}
                    {#if tagInput && !availableTags.some(t => t.toLowerCase() === tagInput.toLowerCase())}
                      <button
                        type="button"
                        onclick={() => {
                          if (!editedLot.tags.includes(tagInput.trim())) {
                            editedLot.tags = [...editedLot.tags, tagInput.trim()];
                          }
                          tagInput = '';
                          showTagDropdown = false;
                        }}
                        class="w-full text-left px-4 py-2 hover:bg-green-50 text-sm text-green-600 font-semibold"
                      >
                        + Create "{tagInput}"
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            
            <!-- Category Meta Fields -->
            {#if editedLot.category && getMetaFieldsForCategory(editedLot.category).length > 0}
              <div class="border-t border-gray-200 pt-4 mt-4">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Category-Specific Fields</h3>
                <div class="space-y-4">
                  {#each getMetaFieldsForCategory(editedLot.category) as field}
                    <div>
                      <label for="meta_{field.key}" class="block text-sm font-medium text-gray-700 mb-2">
                        {field.label}
                        {#if field.required}
                          <span class="text-red-500">*</span>
                        {/if}
                      </label>
                      {#if field.type === 'text'}
                        <input
                          id="meta_{field.key}"
                          type="text"
                          value={editedLot.metaFields[field.key] || ''}
                          oninput={(e) => editedLot.metaFields[field.key] = e.target.value}
                          required={field.required}
                          placeholder={field.placeholder || ''}
                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      {:else if field.type === 'number'}
                        <input
                          id="meta_{field.key}"
                          type="number"
                          value={editedLot.metaFields[field.key] || ''}
                          oninput={(e) => editedLot.metaFields[field.key] = e.target.value}
                          required={field.required}
                          placeholder={field.placeholder || ''}
                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      {:else if field.type === 'date'}
                        <input
                          id="meta_{field.key}"
                          type="date"
                          value={editedLot.metaFields[field.key] || ''}
                          oninput={(e) => editedLot.metaFields[field.key] = e.target.value}
                          required={field.required}
                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      {:else if field.type === 'boolean'}
                        <label class="flex items-center">
                          <input
                            id="meta_{field.key}"
                            type="checkbox"
                            checked={editedLot.metaFields[field.key] || false}
                            onchange={(e) => editedLot.metaFields[field.key] = e.target.checked}
                            class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span class="text-sm text-gray-700">Yes</span>
                        </label>
                      {:else if field.type === 'select'}
                        <select
                          id="meta_{field.key}"
                          value={editedLot.metaFields[field.key] || ''}
                          onchange={(e) => editedLot.metaFields[field.key] = e.target.value}
                          required={field.required}
                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select {field.label}</option>
                          {#each field.options || [] as option}
                            <option value={option}>{option}</option>
                          {/each}
                        </select>
                      {/if}
                      {#if field.helpText}
                        <p class="mt-1 text-xs text-gray-500">{field.helpText}</p>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
            
            <!-- Pricing -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="startingBid" class="block text-sm font-medium text-gray-700 mb-2">
                  Starting Bid ($) *
                </label>
                <input
                  id="startingBid"
                  type="number"
                  bind:value={editedLot.startingBid}
                  required
                  min="0"
                  step="0.01"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label for="bidIncrement" class="block text-sm font-medium text-gray-700 mb-2">
                  Bid Increment ($) *
                </label>
                <input
                  id="bidIncrement"
                  type="number"
                  bind:value={editedLot.bidIncrement}
                  required
                  min="1"
                  step="0.01"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <!-- Status and End Time -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="status" class="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  id="status"
                  bind:value={editedLot.status}
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="sold">Sold</option>
                  <option value="unsold">Unsold</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
              
              <div>
                <label for="endTime" class="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <input
                  id="endTime"
                  type="datetime-local"
                  bind:value={editedLot.endTime}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label for="initialTimerSeconds" class="block text-sm font-medium text-gray-700 mb-2">Time on block (seconds)</label>
                <input id="initialTimerSeconds" type="number" min="1" bind:value={editedLot.initialTimerSeconds} placeholder="Inherit from auction" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label for="bidExtensionSeconds" class="block text-sm font-medium text-gray-700 mb-2">Bid refresh threshold (seconds)</label>
                <input id="bidExtensionSeconds" type="number" min="1" bind:value={editedLot.bidExtensionSeconds} placeholder="Inherit from auction" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            
            <!-- Images -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Images
              </label>
              {#if lot.images && lot.images.length > 0}
                <div class="grid grid-cols-4 gap-4 mb-4">
                  {#each lot.images as image}
                    <div class="relative">
                      <img
                        src={image.url}
                        alt="Lot image"
                        class="w-full h-24 object-cover rounded border border-gray-300"
                      />
                      <button
                        type="button"
                        onclick={async () => {
                          try {
                            const response = await fetch(`/api/lots/${$page.params.lotId}/images?imageId=${image.id}`, {
                              method: 'DELETE'
                            });
                            if (response.ok) {
                              await loadData();
                            }
                          } catch (error) {
                            console.error('Error deleting image:', error);
                          }
                        }}
                        class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
              <div class="mb-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    bind:checked={removeBackground}
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span class="text-sm text-gray-700">Remove background automatically</span>
                </label>
                <p class="text-xs text-gray-500 ml-6">Uses AI to remove background from images</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onchange={handleImageUpload}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p class="mt-1 text-xs text-gray-500">Select multiple images to upload</p>
            </div>
          </div>
          
          <div class="flex gap-4 mt-6">
            <button
              type="button"
              onclick={() => goto(`/seller/auctions/${$page.params.id}/lots`)}
              class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    {:else}
      <div class="bg-white rounded-lg shadow-lg p-12 text-center">
        <p class="text-gray-600 text-lg mb-4">Lot not found</p>
        <button
          onclick={() => goto(`/seller/auctions/${$page.params.id}/lots`)}
          class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          Back to Lots
        </button>
      </div>
    {/if}
  </div>
</div>
