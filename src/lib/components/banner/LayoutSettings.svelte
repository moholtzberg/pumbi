<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import CollapsibleSection from './CollapsibleSection.svelte';
  
  let {
    bannerSettings = $bindable({}),
    imageLayouts = [],
    isCollapsed = $bindable(true)
  } = $props();
</script>

<CollapsibleSection
  title={ui("Layout")}
  bind:isCollapsed
  bgColor="bg-gray-50"
  borderColor="border-gray-200"
  hoverColor="hover:bg-gray-100"
>
  <div class="space-y-3">
    <div>
      <label for="image-layout" class="block text-xs font-medium text-gray-700 mb-1">
        {ui("Image Layout")}
      </label>
      <select
        id="image-layout"
        bind:value={bannerSettings.imageLayout}
        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {#each imageLayouts as layout}
          <option value={layout.value}>{layout.label}</option>
        {/each}
      </select>
    </div>
    
    <div>
      <label for="image-position" class="block text-xs font-medium text-gray-700 mb-1">
        {ui("Image Position")}
      </label>
      <select
        id="image-position"
        bind:value={bannerSettings.imagePosition}
        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        <option value="cover">{ui("Cover (Fill)")}</option>
        <option value="contain">{ui("Contain (Fit)")}</option>
      </select>
    </div>

    {#if bannerSettings.imageLayout !== 'full' && bannerSettings.imageLayout !== 'center'}
      <div>
        <label for="text-image-ratio" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Text/Image Ratio:")} {Math.round(bannerSettings.textImageRatio * 100)}% / {Math.round((1 - bannerSettings.textImageRatio) * 100)}%
        </label>
        <input
          id="text-image-ratio"
          type="range"
          min="0.2"
          max="0.8"
          step="0.1"
          bind:value={bannerSettings.textImageRatio}
          class="w-full"
        />
      </div>
    {/if}
    
    {#if bannerSettings.imageLayout === 'collage'}
      <div>
        <label for="collage-image-side" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Image Side")}
        </label>
        <select
          id="collage-image-side"
          bind:value={bannerSettings.collageImageSide}
          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="left">{ui("Left")}</option>
          <option value="right">{ui("Right")}</option>
        </select>
      </div>
      
      <div>
        <label for="collage-split-style" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Split Style")}
        </label>
        <select
          id="collage-split-style"
          bind:value={bannerSettings.collageSplitStyle}
          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="vertical">{ui("Vertical")}</option>
          <!-- <option value="diagonal-forward">Diagonal Forward (/)</option> -->
          <!-- <option value="diagonal-backward">Diagonal Backward (\)</option> -->
        </select>
        <p class="text-xs text-gray-500 mt-1">{ui("Style of split between text and image areas")}</p>
      </div>
    {/if}
    
    {#if bannerSettings.imageLayout !== 'collage'}
      <div>
        <label for="image-opacity" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Image Opacity:")} {Math.round(bannerSettings.imageOpacity * 100)}%
        </label>
        <input
          id="image-opacity"
          type="range"
          min="0"
          max="1"
          step="0.1"
          bind:value={bannerSettings.imageOpacity}
          class="w-full"
        />
      </div>
      
      <!-- Image Orientation Controls -->
      <div>
        <h4 class="block text-xs font-medium text-gray-700 mb-2">
          {ui("Image Orientation")}
        </h4>
        
        <div class="mb-3">
          <label for="image-rotation" class="block text-xs text-gray-600 mb-1">
            {ui("Rotation:")} {bannerSettings.imageRotation}°
          </label>
          <div class="flex items-center gap-2">
            <input
              id="image-rotation"
              type="range"
              min="-180"
              max="180"
              step="1"
              bind:value={bannerSettings.imageRotation}
              class="flex-1"
            />
            <button
              type="button"
              onclick={() => bannerSettings.imageRotation = 0}
              class="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
            >
              {ui("Reset")}
            </button>
          </div>
        </div>
        
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={bannerSettings.imageFlipHorizontal}
              class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <span class="text-xs text-gray-700">{ui("Flip Horizontal")}</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={bannerSettings.imageFlipVertical}
              class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <span class="text-xs text-gray-700">{ui("Flip Vertical")}</span>
          </label>
        </div>
      </div>
    {/if}
    
    <!-- Image Size/Zoom Control (applies to all layouts except collage) -->
    {#if bannerSettings.imageLayout !== 'collage'}
      <div>
        <label for="image-size" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Image Size/Zoom:")} {Math.round(bannerSettings.imageSize * 100)}%
        </label>
        <div class="flex items-center gap-2">
          <input
            id="image-size"
            type="range"
            min="0.1"
            max="2.0"
            step="0.05"
            bind:value={bannerSettings.imageSize}
            class="flex-1"
          />
          <button
            type="button"
            onclick={() => bannerSettings.imageSize = 1.0}
            class="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
          >
            {ui("Reset")}
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {ui("Adjusts the size of images in all layouts (100% = default size)")}
        </p>
      </div>
    {/if}
  </div>
</CollapsibleSection>

