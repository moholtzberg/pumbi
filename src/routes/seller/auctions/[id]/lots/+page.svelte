<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import BannerGenerator from '$lib/components/BannerGenerator.svelte';
  
  let auction = $state(null);
  let lots = $state([]);
  let loading = $state(true);
  let showCreateModal = $state(false);
  let createError = $state('');
  
  let newLot = $state({
    lotNumber: 1,
    title: '',
    description: '',
    category: '',
    tags: [],
    metaFields: {},
    startingBid: 0,
    bidIncrement: 100,
    imageUrl: '',
    uploadedImages: [],
    status: 'active',
    endTime: '',
    initialTimerSeconds: null,
    bidExtensionSeconds: null
  });
  
  let removeBackground = $state(false);
  
  let categoryMetaFieldsConfig = $state({});
  let auctionHouseId = $state(null);
  
  let availableCategories = $state([]);
  let availableTags = $state([]);
  let categoryInput = $state('');
  let tagInput = $state('');
  let showCategoryDropdown = $state(false);
  let showTagDropdown = $state(false);
  
  let currentAuctionId = $state(null);
  let draggedLot = $state(null);
  let reordering = $state(false);
  let showBannerTool = $state(false);
  
  // Banner tool state
  let selectedBannerLotId = $state('');
  let selectedLotImages = $state([]); // All images from selected lot
  let selectedBannerImages = $state([]); // Images selected for banner
  let bannerSettings = $state({
    title: '',
    titleHebrew: '',
    subtitle: '',
    subtitleHebrew: '',
    yearEnglish: '',
    yearHebrew: '',
    category: '',
    categoryHebrew: '',
    primaryImageUrl: '',
    width: 1200,
    height: 630,
    fontSize: 48,
    fontFamily: 'Cormorant Garamond, Times New Roman, serif',
    hebrewFontFamily: 'Frank Ruhl Libre, Cardo, serif',
    textColor: '#2C1810',
    backgroundColor: 'rgba(245, 241, 232, 0.95)'
  });
  let generatedBannerUrl = $state(null);
  let generatingBanner = $state(false);
  
  // Available fonts
  const fonts = [
    { name: 'Cormorant Garamond (Serif)', value: 'Cormorant Garamond, serif' },
    { name: 'Playfair Display (Serif)', value: 'Playfair Display, serif' },
    { name: 'Times New Roman (Serif)', value: 'Times New Roman, serif' },
    { name: 'Georgia (Serif)', value: 'Georgia, serif' },
    { name: 'Arial (Sans-serif)', value: 'Arial, sans-serif' }
  ];
  
  const hebrewFonts = [
    { name: 'Frank Ruhl Libre (Serif, Recommended)', value: 'Frank Ruhl Libre, Times New Roman, serif' },
    { name: 'Cardo (Serif, Recommended)', value: 'Cardo, Times New Roman, serif' },
    { name: 'David Libre (Serif)', value: 'David Libre, Times New Roman, serif' },
    { name: 'Noto Serif Hebrew (Serif)', value: 'Noto Serif Hebrew, Georgia, serif' },
    { name: 'Tinos (Serif)', value: 'Tinos, Times New Roman, serif' },
    { name: 'Suez One (Serif)', value: 'Suez One, Times New Roman, serif' },
    { name: 'Times New Roman (Serif)', value: 'Times New Roman, serif' },
    { name: 'Georgia (Serif)', value: 'Georgia, serif' },
    { name: 'David (Serif)', value: 'David, Times New Roman, serif' },
    { name: 'Miriam (Serif)', value: 'Miriam, Times New Roman, serif' },
    { name: 'Noto Sans Hebrew (Sans-serif)', value: 'Noto Sans Hebrew, Arial, sans-serif' },
    { name: 'Heebo (Sans-serif)', value: 'Heebo, Arial, sans-serif' },
    { name: 'Rubik (Sans-serif)', value: 'Rubik, Arial, sans-serif' },
    { name: 'Alef (Sans-serif)', value: 'Alef, Arial, sans-serif' },
    { name: 'Assistant (Sans-serif)', value: 'Assistant, Arial, sans-serif' },
    { name: 'Varela Round (Sans-serif)', value: 'Varela Round, Arial, sans-serif' },
    { name: 'Secular One (Sans-serif)', value: 'Secular One, Arial, sans-serif' },
    { name: 'Miriam Libre (Sans-serif)', value: 'Miriam Libre, Arial, sans-serif' },
    { name: 'Arimo (Sans-serif)', value: 'Arimo, Arial, sans-serif' },
    { name: 'Arial Hebrew (Sans-serif)', value: 'Arial Hebrew, Arial, sans-serif' }
  ];
  
  // Convert Gregorian year to Hebrew year format
  function convertToHebrewYear(year) {
    if (!year || isNaN(year)) return '';
    const yearNum = parseInt(year);
    if (yearNum < 1000 || yearNum > 9999) return '';
    const hebrewYear = yearNum + 3760;
    // Simplified Hebrew year conversion
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
    let result = '';
    let remaining = hebrewYear;
    if (remaining >= 5000) {
      result += 'ה\'';
      remaining -= 5000;
    }
    const hundredsDigit = Math.floor(remaining / 100);
    if (hundredsDigit > 0 && hundredsDigit <= 4) {
      result += hundreds[hundredsDigit];
      remaining -= hundredsDigit * 100;
    }
    const tensDigit = Math.floor(remaining / 10);
    if (tensDigit > 0 && tensDigit <= 9) {
      result += tens[tensDigit];
      remaining -= tensDigit * 10;
    }
    if (remaining > 0 && remaining <= 9) {
      result += ones[remaining];
    }
    if (result.length > 1 && !result.startsWith('ה\'')) {
      const lastChar = result.slice(-1);
      const beforeLast = result.slice(0, -1);
      result = beforeLast + '׳' + lastChar;
    }
    return result || '';
  }
  
  onMount(() => {
    if ($page.params.id) {
      currentAuctionId = $page.params.id;
      loadData();
    }
  });
  
  // Only reload if the auction ID actually changes
  $effect(() => {
    if ($page.params.id && $page.params.id !== currentAuctionId) {
      currentAuctionId = $page.params.id;
      loadData();
    }
  });
  
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
  
  async function initializePositions() {
    // Set positions based on current order (1, 2, 3, ...)
    const updates = lots.map((lot, index) => {
      return fetch(`/api/lots/${lot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: index + 1 })
      });
    });
    await Promise.all(updates);
  }
  
  async function reorderLots() {
    if (reordering) return;
    reordering = true;
    
    try {
      const lotIds = lots.map(lot => lot.id);
      const response = await fetch('/api/lots/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: $page.params.id,
          lotIds: lotIds
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reorder lots');
      }
      
      // Reload data to get updated positions
      await loadData();
    } catch (error) {
      console.error('Error reordering lots:', error);
      alert('Failed to reorder lots. Please try again.');
    } finally {
      reordering = false;
    }
  }
  
  function handleDragStart(lot) {
    draggedLot = lot;
  }
  
  function handleDragOver(event, targetLot) {
    event.preventDefault();
    if (!draggedLot || draggedLot.id === targetLot.id) return;
    
    const draggedIndex = lots.findIndex(l => l.id === draggedLot.id);
    const targetIndex = lots.findIndex(l => l.id === targetLot.id);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Reorder in local state
    const newLots = [...lots];
    const [removed] = newLots.splice(draggedIndex, 1);
    newLots.splice(targetIndex, 0, removed);
    lots = newLots;
    
    // Update dragged lot reference
    draggedLot = removed;
  }
  
  function handleDragEnd() {
    if (draggedLot) {
      reorderLots();
      draggedLot = null;
    }
  }
  
  function moveLotUp(index) {
    if (index === 0) return;
    const newLots = [...lots];
    [newLots[index - 1], newLots[index]] = [newLots[index], newLots[index - 1]];
    lots = newLots;
    reorderLots();
  }
  
  function moveLotDown(index) {
    if (index === lots.length - 1) return;
    const newLots = [...lots];
    [newLots[index], newLots[index + 1]] = [newLots[index + 1], newLots[index]];
    lots = newLots;
    reorderLots();
  }
  
  async function loadData() {
    try {
      loading = true;
      const [auctionRes, lotsRes] = await Promise.all([
        fetch(`/api/auctions/${$page.params.id}`),
        fetch(`/api/lots?auctionId=${$page.params.id}`)
      ]);
      
      auction = await auctionRes.json();
      lots = await lotsRes.json();
      auctionHouseId = auction?.auctionHouseId;
      
      // Set default lot number
      if (lots.length > 0) {
        newLot.lotNumber = lots.length + 1;
      }
      
      // Initialize positions if not set
      if (lots.length > 0 && lots.some(lot => !lot.position || lot.position === 0)) {
        await initializePositions();
      }
      
      // Load categories and tags after auction is loaded
      await loadCategoriesAndTags();
      
      // Load category meta fields configuration
      await loadCategoryMetaFieldsConfig();
      
      // Set default end time to auction end time
      if (auction && !newLot.endTime) {
        const endDate = new Date(auction.endDate);
        const year = endDate.getFullYear();
        const month = String(endDate.getMonth() + 1).padStart(2, '0');
        const day = String(endDate.getDate()).padStart(2, '0');
        const hours = String(endDate.getHours()).padStart(2, '0');
        const minutes = String(endDate.getMinutes()).padStart(2, '0');
        newLot.endTime = `${year}-${month}-${day}T${hours}:${minutes}`;
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      loading = false;
    }
  }
  
  
  async function handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('removeBackground', removeBackground.toString());

      const uploadResponse = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload images');
      }

      const { images: uploadedImages } = await uploadResponse.json();
      newLot.uploadedImages = [...(newLot.uploadedImages || []), ...uploadedImages];
      
      // Clear the file input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
    }
  }

  async function createLot() {
    createError = '';
    try {
      // Prepare images array for lot creation
      const images = [];
      
      // Add uploaded images
      if (newLot.uploadedImages && newLot.uploadedImages.length > 0) {
        newLot.uploadedImages.forEach((img, index) => {
          images.push({
            url: img.url || img,
            key: img.key,
            displayOrder: index,
            isPrimary: index === 0
          });
        });
      }
      
      // Add URL input if provided
      if (newLot.imageUrl && newLot.imageUrl.trim() !== '') {
        images.push({
          url: newLot.imageUrl.trim(),
          displayOrder: images.length,
          isPrimary: images.length === 0
        });
      }

      const response = await fetch('/api/lots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newLot,
          auctionId: auction.id,
          currentBid: newLot.startingBid,
          highestBidderId: null,
          highestBidderName: null,
          tags: newLot.tags.length > 0 ? newLot.tags : null,
          metaFields: Object.keys(newLot.metaFields || {}).length > 0 ? newLot.metaFields : null,
          images
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showCreateModal = false;
        createError = '';
        const endDate = new Date(auction.endDate);
        const year = endDate.getFullYear();
        const month = String(endDate.getMonth() + 1).padStart(2, '0');
        const day = String(endDate.getDate()).padStart(2, '0');
        const hours = String(endDate.getHours()).padStart(2, '0');
        const minutes = String(endDate.getMinutes()).padStart(2, '0');
        const defaultEndTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        newLot = {
          lotNumber: lots.length + 2,
          title: '',
          description: '',
          category: '',
          tags: [],
          metaFields: {},
          startingBid: 0,
          bidIncrement: 100,
          imageUrl: '',
          uploadedImages: [],
          status: 'active',
          endTime: defaultEndTime,
          initialTimerSeconds: null,
          bidExtensionSeconds: null
        };
        categoryInput = '';
        tagInput = '';
        await loadData();
        
        // Update auction total lots count
        await fetch(`/api/auctions/${auction.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            totalLots: lots.length + 1
          })
        });
      } else {
        // Display error message
        if (result.error) {
          createError = result.error;
          if (result.details) {
            const detailMessages = Object.entries(result.details)
              .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
              .join('; ');
            if (detailMessages) {
              createError += ' - ' + detailMessages;
            }
          }
        } else {
          createError = 'Failed to create lot. Please try again.';
        }
      }
    } catch (error) {
      console.error('Error creating lot:', error);
      createError = 'An error occurred while creating the lot. Please try again.';
    }
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

{#if loading}
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
{:else if auction}
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-8">
      <button
        onclick={() => goto('/seller')}
        class="text-blue-600 hover:text-blue-800 mb-6 flex items-center"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Auctions
      </button>

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-4xl font-bold text-gray-900">Manage Lots</h1>
            <a
              href="/seller/auctions/{auction.id}/control-room"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              Control room
            </a>
            <a
              href="/seller/auctions/{auction.id}/lots/advanced"
              class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              Advanced View
            </a>
            <a
              href="/seller/auctions/{auction.id}/lots/bulk"
              class="ml-2 px-4 py-2 text-sm font-medium text-white bg-violet-700 rounded-lg hover:bg-violet-800"
            >
              Bulk CSV / Grid
            </a>
          </div>
          <p class="text-gray-600 text-lg">{auction.title}</p>
        </div>
        <div class="flex gap-3">
          <button
            onclick={() => showBannerTool = !showBannerTool}
            class="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            {showBannerTool ? 'Hide' : 'Show'} Banner Tool
          </button>
          <button
            onclick={() => goto(`/seller/auctions/${auction.id}/lots/tools`)}
            class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-semibold"
          >
            Full Banner Tools
          </button>
          <button
            onclick={() => showCreateModal = true}
            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Add New Lot
          </button>
        </div>
      </div>

      <!-- Banner Tool Section -->
      {#if showBannerTool}
        <div class="mb-8">
          <BannerGenerator {lots} {auction} auctionHouse={auction?.auctionHouse} />
        </div>
      {/if}
      
      {#if false}
        <!-- Old banner code removed - now using BannerGenerator component -->
        <div class="mb-8 bg-white rounded-lg shadow-lg p-6 border-2 border-purple-200">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold text-gray-900">Quick Banner Generator</h2>
            <button
              onclick={() => showBannerTool = false}
              class="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Left: Settings -->
            <div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Select Lot (Optional)
                </label>
                <select
                  bind:value={selectedBannerLotId}
                  onchange={async (e) => {
                    const lotId = e.target.value;
                    selectedBannerImages = [];
                    selectedLotImages = [];
                    
                    if (lotId) {
                      const lot = lots.find(l => l.id === lotId);
                      if (lot) {
                        bannerSettings.title = lot.title || '';
                        bannerSettings.titleHebrew = lot.hebrewTitle || lot.HebrewTitle || '';
                        bannerSettings.subtitle = lot.description ? lot.description.substring(0, 150) : '';
                        bannerSettings.subtitleHebrew = lot.hebrewDescription || lot.HebrewDescription || '';
                        
                        // Extract year from title if it contains a year
                        const yearMatch = lot.title?.match(/\b(18|19|20)\d{2}\b/);
                        if (yearMatch) {
                          bannerSettings.yearEnglish = yearMatch[0];
                          bannerSettings.yearHebrew = convertToHebrewYear(yearMatch[0]);
                        }
                        
                        // Load all images from the lot
                        console.log('Loading images for lot:', lot.id, lot);
                        const images = [];
                        
                        // Check for new images array (from LotImage relation)
                        // Images from db.lots.getByAuctionId are already presigned URLs
                        if (lot.images && Array.isArray(lot.images) && lot.images.length > 0) {
                          console.log('Found images array:', lot.images);
                          lot.images.forEach(img => {
                            // Handle both object format {url, id, isPrimary} and string format
                            const imageUrl = typeof img === 'string' ? img : (img.url || img);
                            const imageId = img.id || `img-${images.length}`;
                            const isPrimary = img.isPrimary || false;
                            
                            images.push({
                              url: imageUrl,
                              id: imageId,
                              isPrimary: isPrimary
                            });
                          });
                        }
                        
                        // Fallback to legacy imageUrls
                        if (images.length === 0 && lot.imageUrls) {
                          try {
                            const parsed = typeof lot.imageUrls === 'string' 
                              ? JSON.parse(lot.imageUrls) 
                              : lot.imageUrls;
                            if (Array.isArray(parsed) && parsed.length > 0) {
                              console.log('Found imageUrls:', parsed);
                              parsed.forEach((url, index) => {
                                images.push({
                                  url: url,
                                  id: `legacy-${index}`,
                                  isPrimary: index === 0
                                });
                              });
                            }
                          } catch (e) {
                            console.warn('Failed to parse imageUrls:', e);
                          }
                        }
                        
                        // Fallback to single imageUrl
                        if (images.length === 0 && lot.imageUrl) {
                          console.log('Found single imageUrl:', lot.imageUrl);
                          images.push({
                            url: lot.imageUrl,
                            id: 'legacy-single',
                            isPrimary: true
                          });
                        }
                        
                        console.log('Processed images:', images);
                        
                        // Images from database are already presigned URLs, so use them directly
                        const imagesWithPresigned = images.map((img) => {
                          // The images from db.lots.getByAuctionId are already presigned
                          // Use the url as both displayUrl and url (they're the same)
                          return {
                            ...img,
                            url: img.url, // Already presigned from database
                            displayUrl: img.url // Use same URL for display (already presigned)
                          };
                        });
                        
                        console.log('Final images with presigned:', imagesWithPresigned);
                        
                        selectedLotImages = imagesWithPresigned;
                        
                        // Auto-select first image (or primary image)
                        const primaryImage = imagesWithPresigned.find(img => img.isPrimary) || imagesWithPresigned[0];
                        if (primaryImage) {
                          selectedBannerImages = [primaryImage];
                          bannerSettings.primaryImageUrl = primaryImage.url;
                        }
                      }
                    } else {
                      // Reset to auction defaults
                      if (auction) {
                        bannerSettings.title = auction.title || '';
                        bannerSettings.subtitle = auction.description ? auction.description.substring(0, 150) : '';
                        bannerSettings.primaryImageUrl = auction.imageUrl || '';
                        bannerSettings.titleHebrew = '';
                        bannerSettings.subtitleHebrew = '';
                        bannerSettings.yearEnglish = '';
                        bannerSettings.yearHebrew = '';
                      }
                    }
                  }}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                >
                  <option value="">-- Use Auction Defaults --</option>
                  {#each lots as lot}
                    <option value={lot.id}>
                      Lot #{lot.lotNumber}: {lot.title}
                    </option>
                  {/each}
                </select>
              </div>
              
              <!-- Image Selection -->
              {#if selectedLotImages.length > 0}
                <div class="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 class="text-lg font-semibold text-gray-900 mb-3">Select Images for Banner</h3>
                  <div class="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {#each selectedLotImages as image}
                      {@const isSelected = selectedBannerImages.some(sel => sel.id === image.id || sel.url === image.url)}
                      <div
                        class="relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all {isSelected ? 'border-purple-600 ring-2 ring-purple-300' : 'border-gray-300 hover:border-purple-400'}"
                        onclick={() => {
                          if (isSelected) {
                            selectedBannerImages = selectedBannerImages.filter(sel => sel.id !== image.id && sel.url !== image.url);
                          } else {
                            selectedBannerImages = [...selectedBannerImages, image];
                          }
                          // Update primary image URL to first selected
                          if (selectedBannerImages.length > 0) {
                            bannerSettings.primaryImageUrl = selectedBannerImages[0].url;
                          } else {
                            bannerSettings.primaryImageUrl = '';
                          }
                        }}
                      >
                        <img
                          src={image.displayUrl || image.url}
                          alt="Lot image"
                          class="w-full h-24 object-cover"
                          onerror={(e) => {
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                        {#if isSelected}
                          <div class="absolute top-1 right-1 bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            ✓
                          </div>
                        {/if}
                        {#if image.isPrimary}
                          <div class="absolute bottom-1 left-1 bg-blue-600 text-white text-xs px-1 rounded">
                            Primary
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                  <p class="text-xs text-gray-600 mt-2">
                    {selectedBannerImages.length} image{selectedBannerImages.length !== 1 ? 's' : ''} selected
                    {selectedBannerImages.length > 1 ? ' (will create collage)' : ''}
                  </p>
                </div>
              {/if}
              
              <!-- English Fields -->
              <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">English Text</h3>
                
                <div class="mb-4">
                  <label for="title-en" class="block text-sm font-medium text-gray-700 mb-2">
                    Title (English)
                  </label>
                  <input
                    id="title-en"
                    type="text"
                    bind:value={bannerSettings.title}
                    placeholder="Banner title"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div class="mb-4">
                  <label for="subtitle-en" class="block text-sm font-medium text-gray-700 mb-2">
                    Subtitle (English)
                  </label>
                  <textarea
                    id="subtitle-en"
                    bind:value={bannerSettings.subtitle}
                    placeholder="Banner subtitle"
                    rows="2"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  ></textarea>
                </div>
                
                <div class="mb-4">
                  <label for="year-en" class="block text-sm font-medium text-gray-700 mb-2">
                    Year (English)
                  </label>
                  <input
                    id="year-en"
                    type="text"
                    bind:value={bannerSettings.yearEnglish}
                    placeholder="e.g., 1890"
                    oninput={(e) => {
                      bannerSettings.yearEnglish = e.target.value;
                      if (bannerSettings.yearEnglish) {
                        bannerSettings.yearHebrew = convertToHebrewYear(bannerSettings.yearEnglish);
                      }
                    }}
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <!-- Hebrew Fields -->
              <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Hebrew Text</h3>
                
                <div class="mb-4">
                  <label for="title-he" class="block text-sm font-medium text-gray-700 mb-2">
                    Title (Hebrew)
                  </label>
                  <input
                    id="title-he"
                    type="text"
                    bind:value={bannerSettings.titleHebrew}
                    placeholder="כותרת בעברית"
                    dir="rtl"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div class="mb-4">
                  <label for="subtitle-he" class="block text-sm font-medium text-gray-700 mb-2">
                    Subtitle (Hebrew)
                  </label>
                  <textarea
                    id="subtitle-he"
                    bind:value={bannerSettings.subtitleHebrew}
                    placeholder="תת-כותרת בעברית"
                    rows="2"
                    dir="rtl"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  ></textarea>
                </div>
                
                <div class="mb-4">
                  <label for="year-he" class="block text-sm font-medium text-gray-700 mb-2">
                    Year (Hebrew)
                  </label>
                  <input
                    id="year-he"
                    type="text"
                    bind:value={bannerSettings.yearHebrew}
                    placeholder="תר״נ"
                    dir="rtl"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <!-- Font & Size Settings -->
              <div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Typography</h3>
                
                <div class="mb-4">
                  <label for="font-size" class="block text-sm font-medium text-gray-700 mb-2">
                    Font Size: {bannerSettings.fontSize}px
                  </label>
                  <input
                    id="font-size"
                    type="range"
                    min="24"
                    max="72"
                    bind:value={bannerSettings.fontSize}
                    class="w-full"
                  />
                </div>
                
                <div class="mb-4">
                  <label for="font-family" class="block text-sm font-medium text-gray-700 mb-2">
                    English Font
                  </label>
                  <select
                    id="font-family"
                    bind:value={bannerSettings.fontFamily}
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {#each fonts as font}
                      <option value={font.value}>{font.name}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="mb-4">
                  <label for="hebrew-font-family" class="block text-sm font-medium text-gray-700 mb-2">
                    Hebrew Font
                  </label>
                  <select
                    id="hebrew-font-family"
                    bind:value={bannerSettings.hebrewFontFamily}
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {#each hebrewFonts as font}
                      <option value={font.value}>{font.name}</option>
                    {/each}
                  </select>
                </div>
              </div>
              
              <!-- Image Settings -->
              <div class="mb-4">
                <label for="image-url" class="block text-sm font-medium text-gray-700 mb-2">
                  Image URL
                </label>
                <input
                  id="image-url"
                  type="text"
                  bind:value={bannerSettings.primaryImageUrl}
                  placeholder="Image URL"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p class="text-xs text-gray-500 mt-1">Make sure the image URL is accessible (CORS enabled or presigned URL)</p>
              </div>
              
              <button
                onclick={generateQuickBanner}
                disabled={generatingBanner || (!bannerSettings.title && !bannerSettings.titleHebrew) || (selectedBannerImages.length === 0 && !bannerSettings.primaryImageUrl)}
                class="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {generatingBanner ? 'Generating...' : 'Generate Banner'}
              </button>
              
              {#if generatedBannerUrl}
                <button
                  onclick={downloadBanner}
                  class="w-full mt-3 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Download Banner
                </button>
              {/if}
            </div>
            
            <!-- Right: Preview -->
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
              {#if generatedBannerUrl}
                <img
                  src={generatedBannerUrl}
                  alt="Generated Banner"
                  class="w-full rounded-lg shadow-lg border border-gray-200"
                />
              {:else}
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
                  <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p class="text-gray-600">Configure settings and click "Generate Banner"</p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if lots.length === 0}
        <div class="bg-white rounded-lg shadow-lg p-12 text-center">
          <p class="text-gray-600 text-lg mb-4">No lots added yet.</p>
          <button
            onclick={() => showCreateModal = true}
            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Add Your First Lot
          </button>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each lots as lot, index (lot.id)}
            <div 
              class="bg-white rounded-lg shadow-md overflow-hidden cursor-move hover:shadow-lg transition-shadow"
              role="button"
              tabindex="0"
              draggable="true"
              ondragstart={() => handleDragStart(lot)}
              ondragover={(e) => handleDragOver(e, lot)}
              ondragend={handleDragEnd}
            >
              <div class="relative">
                {#if lot.imageUrl}
                  <img
                    src={lot.imageUrl}
                    alt={lot.title}
                    class="w-full h-48 object-cover"
                  />
                {:else if lot.imageUrls}
                  {@const images = (() => { try { return JSON.parse(lot.imageUrls); } catch { return []; } })()}
                  {#if images.length > 0}
                    <img
                      src={images[0]}
                      alt={lot.title}
                      class="w-full h-48 object-cover"
                    />
                  {:else}
                    <div class="w-full h-48 bg-gray-200 flex items-center justify-center">
                      <span class="text-gray-400">No image</span>
                    </div>
                  {/if}
                {:else}
                  <div class="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <span class="text-gray-400">No image</span>
                  </div>
                {/if}
                <div class="absolute top-4 left-4 bg-white px-3 py-1 rounded-full text-sm font-bold">
                  Lot #{lot.lotNumber}
                </div>
                <div class="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  #{lot.position || index + 1}
                </div>
              </div>
              <div class="p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-2">{lot.title}</h3>
                <p class="text-gray-600 text-sm mb-4 line-clamp-2">{lot.description}</p>
                <div class="space-y-2 mb-4 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Starting Bid:</span>
                    <span class="font-semibold">{formatCurrency(lot.startingBid)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Current Bid:</span>
                    <span class="font-semibold text-blue-600">{formatCurrency(lot.currentBid)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Bid Increment:</span>
                    <span class="font-semibold">{formatCurrency(lot.bidIncrement)}</span>
                  </div>
                </div>
                <div class="flex gap-2 mb-2">
                  <button
                    onclick={() => goto(`/lots/${lot.id}`)}
                    class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                  >
                    View
                  </button>
                  <button
                    onclick={() => goto(`/seller/auctions/${$page.params.id}/lots/${lot.id}/edit`)}
                    class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm"
                  >
                    Edit
                  </button>
                </div>
                <div class="flex gap-1">
                  <button
                    onclick={() => moveLotUp(index)}
                    disabled={index === 0 || reordering}
                    class="flex-1 bg-gray-200 text-gray-700 py-1 rounded hover:bg-gray-300 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onclick={() => moveLotDown(index)}
                    disabled={index === lots.length - 1 || reordering}
                    class="flex-1 bg-gray-200 text-gray-700 py-1 rounded hover:bg-gray-300 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Create Lot Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Add New Lot</h2>
          <button
            onclick={() => { showCreateModal = false; createError = ''; }}
            class="text-gray-500 hover:text-gray-700"
            aria-label="Close modal"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {#if createError}
          <div class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-red-800 text-sm">{createError}</p>
            </div>
          </div>
        {/if}

        <form onsubmit={(e) => { e.preventDefault(); createLot(); }}>
          <div class="space-y-4">
            <div>
              <label for="lotNumber" class="block text-sm font-medium text-gray-700 mb-2">
                Lot Number *
              </label>
              <input
                id="lotNumber"
                type="number"
                bind:value={newLot.lotNumber}
                required
                min="1"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
                Lot Title *
              </label>
              <input
                id="title"
                type="text"
                bind:value={newLot.title}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Original Oil Painting - Landscape"
              />
            </div>

            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                bind:value={newLot.description}
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
                    newLot.category = categoryInput;
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
                          newLot.category = cat;
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
                          newLot.category = categoryInput;
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
                {#each newLot.tags as tag, index}
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {tag}
                    <button
                      type="button"
                      onclick={() => {
                        newLot.tags = newLot.tags.filter((_, i) => i !== index);
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
                      if (!newLot.tags.includes(tagInput.trim())) {
                        newLot.tags = [...newLot.tags, tagInput.trim()];
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
                    {#each availableTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !newLot.tags.includes(t)) as tag}
                      <button
                        type="button"
                        onclick={() => {
                          if (!newLot.tags.includes(tag)) {
                            newLot.tags = [...newLot.tags, tag];
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
                          if (!newLot.tags.includes(tagInput.trim())) {
                            newLot.tags = [...newLot.tags, tagInput.trim()];
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
            {#if newLot.category && getMetaFieldsForCategory(newLot.category).length > 0}
              <div class="border-t border-gray-200 pt-4 mt-4">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Category-Specific Fields</h3>
                <div class="space-y-4">
                  {#each getMetaFieldsForCategory(newLot.category) as field}
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
                          bind:value={newLot.metaFields[field.key]}
                          required={field.required}
                          placeholder={field.placeholder || ''}
                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      {:else if field.type === 'number'}
                        <input
                          id="meta_{field.key}"
                          type="number"
                          bind:value={newLot.metaFields[field.key]}
                          required={field.required}
                          placeholder={field.placeholder || ''}
                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      {:else if field.type === 'date'}
                        <input
                          id="meta_{field.key}"
                          type="date"
                          bind:value={newLot.metaFields[field.key]}
                          required={field.required}
                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      {:else if field.type === 'boolean'}
                        <label class="flex items-center">
                          <input
                            id="meta_{field.key}"
                            type="checkbox"
                            bind:checked={newLot.metaFields[field.key]}
                            class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span class="text-sm text-gray-700">Yes</span>
                        </label>
                      {:else if field.type === 'select'}
                        <select
                          id="meta_{field.key}"
                          bind:value={newLot.metaFields[field.key]}
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

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="startingBid" class="block text-sm font-medium text-gray-700 mb-2">
                  Starting Bid ($) *
                </label>
                <input
                  id="startingBid"
                  type="number"
                  bind:value={newLot.startingBid}
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
                  bind:value={newLot.bidIncrement}
                  required
                  min="1"
                  step="0.01"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label for="imageUrl" class="block text-sm font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <input
                id="imageUrl"
                type="url"
                bind:value={newLot.imageUrl}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                placeholder="https://example.com/image.jpg"
              />
              <p class="text-xs text-gray-500 mb-2">OR</p>
              <label for="imageFiles" class="block text-sm font-medium text-gray-700 mb-2">
                Upload Images
              </label>
              <input
                id="imageFiles"
                type="file"
                accept="image/*"
                multiple
                onchange={handleImageUpload}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {#if newLot.uploadedImages && newLot.uploadedImages.length > 0}
                <div class="mt-2 flex flex-wrap gap-2">
                  {#each newLot.uploadedImages as image}
                    <div class="relative">
                      <img src={image.url || image} alt="Uploaded" class="w-20 h-20 object-cover rounded border border-gray-300" />
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div>
              <label for="endTime" class="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <input
                id="endTime"
                type="datetime-local"
                bind:value={newLot.endTime}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="initialTimerSeconds" class="block text-sm font-medium text-gray-700 mb-2">Time on block (seconds)</label>
                <input id="initialTimerSeconds" type="number" min="1" bind:value={newLot.initialTimerSeconds} placeholder="Inherit from auction" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label for="bidExtensionSeconds" class="block text-sm font-medium text-gray-700 mb-2">Bid refresh threshold (seconds)</label>
                <input id="bidExtensionSeconds" type="number" min="1" bind:value={newLot.bidExtensionSeconds} placeholder="Inherit from auction" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div class="flex gap-4 mt-6">
            <button
              type="button"
              onclick={() => showCreateModal = false}
              class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Add Lot
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
