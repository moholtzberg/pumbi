<script>
  import { goto } from '$app/navigation';
  
  let { lots, template, templateSettings, formatCurrency } = $props();
  
  // Track current image index for each lot in slider template
  let sliderIndices = $state(new Map());
  
  // Track image container dimensions for carousel-hover template
  let imageDimensions = $state(new Map());
  
  function getCurrentIndex(lotId) {
    return sliderIndices.get(lotId) || 0;
  }
  
  function setCurrentIndex(lotId, index) {
    sliderIndices.set(lotId, index);
    sliderIndices = new Map(sliderIndices); // Trigger reactivity
  }
  
  function handleImageLoad(lotId, event) {
    const img = event.target;
    if (!imageDimensions.has(lotId)) {
      // Store the first image's rendered dimensions to lock container size
      const renderedWidth = img.offsetWidth || img.clientWidth || 400;
      const renderedHeight = img.offsetHeight || img.clientHeight || 300;
      
      imageDimensions.set(lotId, {
        width: renderedWidth,
        height: renderedHeight
      });
      imageDimensions = new Map(imageDimensions); // Trigger reactivity
    }
  }
  
  function getImageContainerStyle(lotId) {
    const dims = imageDimensions.get(lotId);
    if (dims) {
      // Lock container to first image's size
      return `height: ${dims.height}px; max-height: 500px;`;
    }
    return 'min-height: 400px; max-height: 500px;';
  }
  
  // Get lot images (supporting both new images array and legacy fields)
  // Filters out hidden images by default
  function getLotImages(lot) {
    if (lot.images && Array.isArray(lot.images) && lot.images.length > 0) {
      // Filter out hidden images
      return lot.images
        .filter(img => !img.isHidden)
        .map(img => img.url || img);
    }
    if (lot.imageUrls) {
      try {
        const parsed = JSON.parse(lot.imageUrls);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (lot.imageUrl) {
      return [lot.imageUrl];
    }
    return [];
  }
  
  function getPrimaryImage(lot) {
    const images = getLotImages(lot);
    if (lot.images && Array.isArray(lot.images)) {
      // Find primary image that is not hidden
      const primary = lot.images.find(img => img.isPrimary && !img.isHidden);
      if (primary) return primary.url;
      // If no visible primary, get first visible image
      const firstVisible = lot.images.find(img => !img.isHidden);
      if (firstVisible) return firstVisible.url;
    }
    return images[0] || '/placeholder-lot.jpg';
  }
</script>

{#if template === 'card-grid'}
  <!-- Template 1: Card Grid (Traditional) -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each lots as lot}
      <div
        onclick={() => goto(`/lots/${lot.id}`)}
        class="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
      >
        <div class="relative">
          <img
            src={getPrimaryImage(lot)}
            alt={lot.title}
            class="w-full h-48 object-cover"
          />
          <div class="absolute top-4 left-4 bg-white px-3 py-1 rounded-full text-sm font-bold">
            Lot #{lot.lotNumber}
          </div>
        </div>
        <div class="p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-2">{lot.title}</h3>
          <p class="text-gray-600 text-sm mb-4 line-clamp-2">{lot.description}</p>
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-xs text-gray-500">Current Bid</p>
              <p class="text-xl font-bold text-blue-600">{formatCurrency(lot.currentBid)}</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500">Starting Bid</p>
              <p class="text-lg font-semibold">{formatCurrency(lot.startingBid)}</p>
            </div>
          </div>
          <button class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            View & Bid
          </button>
        </div>
      </div>
    {/each}
  </div>

{:else if template === 'image-slider'}
  <!-- Template 2: Image Slider (Carousel) -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each lots as lot}
      {@const images = getLotImages(lot)}
      {@const primaryImage = getPrimaryImage(lot)}
      {@const currentIndex = getCurrentIndex(lot.id)}
      <div
        class="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
        onclick={() => goto(`/lots/${lot.id}`)}
      >
        <div class="relative">
          {#if images.length > 1}
            <div class="relative h-64 overflow-hidden">
              {#each images as img, idx}
                <img
                  src={img}
                  alt="{lot.title} - Image {idx + 1}"
                  class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 {idx === currentIndex ? 'opacity-100' : 'opacity-0'}"
                />
              {/each}
              <!-- Navigation dots -->
              <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                {#each images as _, idx}
                  <button
                    onclick={(e) => { e.stopPropagation(); setCurrentIndex(lot.id, idx); }}
                    class="w-2 h-2 rounded-full {idx === currentIndex ? 'bg-white' : 'bg-white/50'}"
                    aria-label="Go to image {idx + 1}"
                  ></button>
                {/each}
              </div>
              <!-- Arrow buttons -->
              {#if images.length > 1}
                <button
                  onclick={(e) => { e.stopPropagation(); setCurrentIndex(lot.id, (currentIndex - 1 + images.length) % images.length); }}
                  class="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                  aria-label="Previous image"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                </button>
                <button
                  onclick={(e) => { e.stopPropagation(); setCurrentIndex(lot.id, (currentIndex + 1) % images.length); }}
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                  aria-label="Next image"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              {/if}
            </div>
          {:else}
            <img
              src={primaryImage}
              alt={lot.title}
              class="w-full h-64 object-cover"
            />
          {/if}
          <div class="absolute top-4 left-4 bg-white px-3 py-1 rounded-full text-sm font-bold">
            Lot #{lot.lotNumber}
          </div>
        </div>
        <div class="p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-2">{lot.title}</h3>
          <p class="text-gray-600 text-sm mb-4 line-clamp-2">{lot.description}</p>
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-xs text-gray-500">Current Bid</p>
              <p class="text-xl font-bold text-blue-600">{formatCurrency(lot.currentBid)}</p>
            </div>
          </div>
          <button class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            View & Bid
          </button>
        </div>
      </div>
    {/each}
  </div>

{:else if template === 'overlay-text'}
  <!-- Template 3: Overlay Text (Full image with text overlay, button on hover) -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each lots as lot}
      {@const primaryImage = getPrimaryImage(lot)}
      <div
        class="relative group cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all duration-300"
        onclick={() => goto(`/lots/${lot.id}`)}
      >
        <div class="relative h-80">
          <img
            src={primaryImage}
            alt={lot.title}
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <!-- Gradient overlay -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
          
          <!-- Content overlay -->
          <div class="absolute inset-0 flex flex-col justify-between p-6 text-white">
            <div>
              <div class="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold inline-block mb-3">
                Lot #{lot.lotNumber}
              </div>
              <h3 class="text-2xl font-bold mb-2">{lot.title}</h3>
              <p class="text-sm text-white/90 line-clamp-2 mb-4">{lot.description}</p>
            </div>
            
            <div class="transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <p class="text-xs text-white/80">Current Bid</p>
                  <p class="text-2xl font-bold">{formatCurrency(lot.currentBid)}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-white/80">Starting</p>
                  <p class="text-lg font-semibold">{formatCurrency(lot.startingBid)}</p>
                </div>
              </div>
              <button class="w-full bg-white text-gray-900 py-3 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
                View & Bid
              </button>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

{:else if template === 'minimal-grid'}
  <!-- Template 4: Minimal Grid (Clean minimal design) -->
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    {#each lots as lot}
      {@const primaryImage = getPrimaryImage(lot)}
      <div
        class="bg-white rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-200"
        onclick={() => goto(`/lots/${lot.id}`)}
      >
        <div class="relative aspect-square">
          <img
            src={primaryImage}
            alt={lot.title}
            class="w-full h-full object-cover"
          />
          <div class="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
            #{lot.lotNumber}
          </div>
        </div>
        <div class="p-3">
          <h3 class="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">{lot.title}</h3>
          <p class="text-lg font-bold text-blue-600 mb-2">{formatCurrency(lot.currentBid)}</p>
          <button class="w-full text-xs bg-gray-100 text-gray-700 py-1.5 rounded hover:bg-gray-200 transition-colors">
            View
          </button>
        </div>
      </div>
    {/each}
  </div>

{:else if template === 'masonry'}
  <!-- Template 5: Masonry Layout (Pinterest-style) -->
  <div class="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6">
    {#each lots as lot}
      {@const images = getLotImages(lot)}
      {@const primaryImage = getPrimaryImage(lot)}
      {@const imageHeight = Math.floor(Math.random() * 100) + 200} <!-- Varying heights for masonry effect -->
      <div
        class="break-inside-avoid mb-6 bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
        onclick={() => goto(`/lots/${lot.id}`)}
      >
        <div class="relative">
          <img
            src={primaryImage}
            alt={lot.title}
            class="w-full object-cover"
            style="height: {imageHeight}px;"
          />
          <div class="absolute top-4 left-4 bg-white px-3 py-1 rounded-full text-sm font-bold">
            Lot #{lot.lotNumber}
          </div>
          {#if images.length > 1}
            <div class="absolute top-4 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {images.length} photos
            </div>
          {/if}
        </div>
        <div class="p-4">
          <h3 class="text-lg font-bold text-gray-900 mb-2">{lot.title}</h3>
          <p class="text-gray-600 text-sm mb-3 line-clamp-3">{lot.description}</p>
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-xs text-gray-500">Current Bid</p>
              <p class="text-xl font-bold text-blue-600">{formatCurrency(lot.currentBid)}</p>
            </div>
          </div>
          <button class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm">
            View & Bid
          </button>
        </div>
      </div>
    {/each}
  </div>

{:else if template === 'carousel-hover'}
  <!-- Template 6: Carousel with Hover Content (Natural aspect ratio, content on hover) -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
    {#each lots as lot}
      {@const images = getLotImages(lot)}
      {@const primaryImage = getPrimaryImage(lot)}
      {@const currentIndex = getCurrentIndex(lot.id)}
      <div
        class="relative group cursor-pointer overflow-hidden rounded shadow-md hover:shadow-xl transition-all duration-300 bg-white"
        onclick={() => goto(`/lots/${lot.id}`)}
      >
        <div class="relative w-full flex items-center justify-center bg-gray-50" style={getImageContainerStyle(lot.id)}>
          {#if images.length > 1}
            <div class="relative w-full h-full flex items-center justify-center">
              {#each images as img, idx}
                <img
                  src={img}
                  alt="{lot.title} - Image {idx + 1}"
                  onload={(e) => { if (idx === 0) handleImageLoad(lot.id, e); }}
                  class="transition-opacity duration-500 {idx === currentIndex ? 'opacity-100' : 'opacity-0 absolute inset-0'} w-full h-full"
                  style="object-fit: contain; {idx !== currentIndex ? 'pointer-events: none;' : ''}"
                />
              {/each}
              <!-- Navigation dots -->
              <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 z-10">
                {#each images as _, idx}
                  <button
                    onclick={(e) => { e.stopPropagation(); setCurrentIndex(lot.id, idx); }}
                    class="w-1.5 h-1.5 rounded-full transition-all {idx === currentIndex ? 'bg-white' : 'bg-white/40'}"
                    aria-label="Go to image {idx + 1}"
                  ></button>
                {/each}
              </div>
              <!-- Arrow buttons -->
              {#if images.length > 1}
                <button
                  onclick={(e) => { e.stopPropagation(); setCurrentIndex(lot.id, (currentIndex - 1 + images.length) % images.length); }}
                  class="absolute left-1 top-1/2 transform -translate-y-1/2 bg-black/30 text-white p-1.5 rounded-full hover:bg-black/50 transition-colors z-10 opacity-0 group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                </button>
                <button
                  onclick={(e) => { e.stopPropagation(); setCurrentIndex(lot.id, (currentIndex + 1) % images.length); }}
                  class="absolute right-1 top-1/2 transform -translate-y-1/2 bg-black/30 text-white p-1.5 rounded-full hover:bg-black/50 transition-colors z-10 opacity-0 group-hover:opacity-100"
                  aria-label="Next image"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              {/if}
            </div>
          {:else}
            <img
              src={primaryImage}
              alt={lot.title}
              onload={(e) => handleImageLoad(lot.id, e)}
              class="w-full h-full"
              style="object-fit: contain;"
            />
          {/if}
        </div>
        
        <!-- Hover overlay with content -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white pointer-events-none">
          <div class="transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-auto">
            <div class="bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium inline-block mb-2">
              Lot #{lot.lotNumber}
            </div>
            <h3 class="text-sm font-medium mb-1">{lot.title}</h3>
            <p class="text-xs text-white/85 line-clamp-2 mb-2">{lot.description}</p>
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-[10px] text-white/70">Current Bid</p>
                <p class="text-sm font-medium">{formatCurrency(lot.currentBid)}</p>
              </div>
              <div class="text-right">
                <p class="text-[10px] text-white/70">Starting</p>
                <p class="text-xs font-medium">{formatCurrency(lot.startingBid)}</p>
              </div>
            </div>
            <button class="w-full bg-white/90 text-gray-900 py-1.5 rounded text-xs font-medium hover:bg-white transition-colors">
              View & Bid
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>

{/if}

