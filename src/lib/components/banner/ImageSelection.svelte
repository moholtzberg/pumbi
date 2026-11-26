<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import CollapsibleSection from './CollapsibleSection.svelte';
  
  let {
    selectedLotImages = $bindable([]),
    selectedBannerImages = $bindable([]),
    bannerSettings = $bindable({}),
    applyPresetCollagePositions = () => {},
    updatePrimaryImage = () => {},
    isCollapsed = $bindable(true)
  } = $props();
</script>

{#if selectedLotImages.length > 0}
  <CollapsibleSection
    title={ui("Select Images for Banner")}
    bind:isCollapsed
    bgColor="bg-purple-50"
    borderColor="border-purple-200"
    hoverColor="hover:bg-purple-100"
  >
    <div class="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
      {#each selectedLotImages as image}
        {@const isSelected = selectedBannerImages.some(sel => sel.id === image.id || sel.url === image.url)}
        <div
          class="relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all {isSelected ? 'border-purple-600 ring-2 ring-purple-300' : 'border-gray-300 hover:border-purple-400'}"
          role="button"
          tabindex="0"
          onclick={() => {
            if (isSelected) {
              selectedBannerImages = selectedBannerImages.filter(sel => sel.id !== image.id && sel.url !== image.url);
              applyPresetCollagePositions();
            } else {
              // Preset positions for first 3 images
              const presets = [
                { x: 50, y: 60, zoom: 0.8, zIndex: 3, opacity: 1.0 }, // Center image
                { x: 20, y: 40, zoom: 0.6, zIndex: 1, opacity: 1.0 }, // Image 2
                { x: 80, y: 40, zoom: 0.6, zIndex: 2, opacity: 1.0 }  // Image 3
              ];
              const newIndex = selectedBannerImages.length;
              const preset = presets[newIndex] || { zoom: 1.0, zIndex: newIndex, opacity: 1.0 };
              
              // Add image with preset or default values
              selectedBannerImages = [...selectedBannerImages, {
                ...image,
                rotation: bannerSettings.imageRotation ?? 0,
                flipHorizontal: bannerSettings.imageFlipHorizontal ?? false,
                flipVertical: bannerSettings.imageFlipVertical ?? false,
                zoom: preset.zoom,
                zIndex: preset.zIndex,
                opacity: preset.opacity,
                isFeatured: selectedBannerImages.length === 0 // First image is featured by default
              }];
              
              // Update positions
              applyPresetCollagePositions();
            }
            updatePrimaryImage();
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (isSelected) {
                selectedBannerImages = selectedBannerImages.filter(sel => sel.id !== image.id && sel.url !== image.url);
                applyPresetCollagePositions();
              } else {
                // Preset positions for first 3 images
                const presets = [
                  { x: 50, y: 60, zoom: 0.8, zIndex: 3, opacity: 1.0 }, // Center image
                  { x: 20, y: 40, zoom: 0.6, zIndex: 1, opacity: 1.0 }, // Image 2
                  { x: 80, y: 40, zoom: 0.6, zIndex: 2, opacity: 1.0 }  // Image 3
                ];
                const newIndex = selectedBannerImages.length;
                const preset = presets[newIndex] || { zoom: 1.0, zIndex: newIndex, opacity: 1.0 };
                
                // Add image with preset or default values
                selectedBannerImages = [...selectedBannerImages, {
                  ...image,
                  rotation: bannerSettings.imageRotation ?? 0,
                  flipHorizontal: bannerSettings.imageFlipHorizontal ?? false,
                  flipVertical: bannerSettings.imageFlipVertical ?? false,
                  zoom: preset.zoom,
                  zIndex: preset.zIndex,
                  opacity: preset.opacity,
                  isFeatured: selectedBannerImages.length === 0 // First image is featured by default
                }];
                applyPresetCollagePositions();
              }
              updatePrimaryImage();
            }
          }}
        >
          <img
            src={image.displayUrl || image.url}
            alt=""
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
        </div>
      {/each}
    </div>
  </CollapsibleSection>
{/if}

