<script>
  let { settings = $bindable({}) } = $props();
</script>

<div class="space-y-4">
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Select Template
    </label>
    <select
      bind:value={settings.galleryTemplate}
      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
    >
      <option value="card-grid">Card Grid - Traditional card layout</option>
      <option value="image-slider">
        Image Slider - Carousel with multiple images
      </option>
      <option value="overlay-text">
        Overlay Text - Full image with text overlay
      </option>
      <option value="minimal-grid">Minimal Grid - Clean minimal design</option>
      <option value="masonry">Masonry - Pinterest-style layout</option>
      <option value="carousel-hover">
        Carousel Hover - Natural aspect ratio with content on hover
      </option>
    </select>
    <p class="text-xs text-gray-500 mt-1">
      Choose how lots are displayed in the gallery
    </p>
  </div>

  <!-- Template-specific settings -->
  {#if settings.galleryTemplate === 'card-grid'}
    <div class="border-t pt-4 space-y-3">
      <h4 class="text-sm font-semibold text-gray-900">Card Grid Settings</h4>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Columns
        </label>
        <input
          type="number"
          bind:value={settings.galleryTemplateSettings.cardGridColumns}
          min="1"
          max="5"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
        />
      </div>
      <label class="settings-toggle">
        <input
          type="checkbox"
          bind:checked={
            settings.galleryTemplateSettings.cardGridShowDescription
          }
          class="mr-2 h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">Show description</span>
      </label>
      <label class="settings-toggle">
        <input
          type="checkbox"
          bind:checked={
            settings.galleryTemplateSettings.cardGridShowStartingBid
          }
          class="mr-2 h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">Show starting bid</span>
      </label>
    </div>
  {:else if settings.galleryTemplate === 'image-slider'}
    <div class="border-t pt-4 space-y-3">
      <h4 class="text-sm font-semibold text-gray-900">Image Slider Settings</h4>
      <label class="settings-toggle">
        <input
          type="checkbox"
          bind:checked={settings.galleryTemplateSettings.sliderAutoPlay}
          class="mr-2 h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">Auto-play slideshow</span>
      </label>
      {#if settings.galleryTemplateSettings.sliderAutoPlay}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Auto-play Interval (ms)
          </label>
          <input
            type="number"
            bind:value={settings.galleryTemplateSettings.sliderAutoPlayInterval}
            min="1000"
            step="500"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
          />
        </div>
      {/if}
      <label class="settings-toggle">
        <input
          type="checkbox"
          bind:checked={settings.galleryTemplateSettings.sliderShowDots}
          class="mr-2 h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">Show navigation dots</span>
      </label>
      <label class="settings-toggle">
        <input
          type="checkbox"
          bind:checked={settings.galleryTemplateSettings.sliderShowArrows}
          class="mr-2 h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">Show arrow buttons</span>
      </label>
    </div>
  {:else if settings.galleryTemplate === 'overlay-text'}
    <div class="border-t pt-4 space-y-3">
      <h4 class="text-sm font-semibold text-gray-900">Overlay Text Settings</h4>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Text Position
        </label>
        <select
          bind:value={settings.galleryTemplateSettings.overlayTextPosition}
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
        >
          <option value="top">Top</option>
          <option value="center">Center</option>
          <option value="bottom">Bottom</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Overlay Opacity: {Math.round(
            settings.galleryTemplateSettings.overlayTextOpacity * 100,
          )}%
        </label>
        <input
          type="range"
          bind:value={settings.galleryTemplateSettings.overlayTextOpacity}
          min="0"
          max="1"
          step="0.1"
          class="w-full"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Button Style
        </label>
        <select
          bind:value={settings.galleryTemplateSettings.overlayButtonStyle}
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
        >
          <option value="white">White</option>
          <option value="colored">Colored</option>
          <option value="outline">Outline</option>
        </select>
      </div>
    </div>
  {:else if settings.galleryTemplate === 'minimal-grid'}
    <div class="border-t pt-4 space-y-3">
      <h4 class="text-sm font-semibold text-gray-900">Minimal Grid Settings</h4>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Columns
        </label>
        <input
          type="number"
          bind:value={settings.galleryTemplateSettings.minimalGridColumns}
          min="2"
          max="6"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
        />
      </div>
      <label class="settings-toggle">
        <input
          type="checkbox"
          bind:checked={
            settings.galleryTemplateSettings.minimalGridShowDescription
          }
          class="mr-2 h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">Show description</span>
      </label>
    </div>
  {:else if settings.galleryTemplate === 'masonry'}
    <div class="border-t pt-4 space-y-3">
      <h4 class="text-sm font-semibold text-gray-900">Masonry Settings</h4>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Columns
        </label>
        <input
          type="number"
          bind:value={settings.galleryTemplateSettings.masonryColumns}
          min="2"
          max="5"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
        />
      </div>
      <label class="settings-toggle">
        <input
          type="checkbox"
          bind:checked={settings.galleryTemplateSettings.masonryVaryHeights}
          class="mr-2 h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">Vary image heights</span>
      </label>
    </div>
  {/if}
</div>
