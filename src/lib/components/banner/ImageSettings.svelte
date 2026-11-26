<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import CollapsibleSection from './CollapsibleSection.svelte';
  
  let {
    selectedBannerImages = $bindable([]),
    bannerSettings = $bindable({}),
    applyPresetCollagePositions = () => {},
    updatePrimaryImage = () => {},
    isCollapsed = $bindable(true)
  } = $props();
</script>

{#if selectedBannerImages.length > 0}
  <CollapsibleSection
    title={ui("Image Settings")}
    bind:isCollapsed
    bgColor="bg-blue-50"
    borderColor="border-blue-200"
    hoverColor="hover:bg-blue-100"
  >
    <div class="space-y-2 max-h-[500px] overflow-y-auto">
      {#each selectedBannerImages as image, index}
        {@const pos = bannerSettings.collageImagePositions[index] || { x: 50, y: 50, rotation: 0 }}
        <div
          class="bg-white rounded-lg border border-gray-200 overflow-hidden"
          draggable="true"
          role="listitem"
          ondragstart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index.toString());
            e.currentTarget.classList.add('opacity-50');
          }}
          ondragend={(e) => {
            e.currentTarget.classList.remove('opacity-50');
          }}
          ondragover={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          ondrop={(e) => {
            e.preventDefault();
            const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const dropIndex = index;
            
            if (dragIndex !== dropIndex) {
              const newImages = [...selectedBannerImages];
              const [movedImage] = newImages.splice(dragIndex, 1);
              newImages.splice(dropIndex, 0, movedImage);
              selectedBannerImages = newImages;
              updatePrimaryImage();
            }
          }}
        >
          <!-- Header: Drag Handle, Thumbnail, Position, Actions -->
          <div class="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200">
            <div class="cursor-move text-gray-400 hover:text-gray-600" title={ui("Drag to reorder")}>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
              </svg>
            </div>
            
            <img
              src={image.displayUrl || image.url}
              alt="Image {index + 1}"
              class="w-12 h-12 object-cover rounded"
              onerror={(e) => {
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999"%3E{index + 1}%3C/text%3E%3C/svg%3E';
              }}
            />
            
            <span class="text-sm font-medium text-gray-700">#{index + 1}</span>
            
            <button
              type="button"
              onclick={() => {
                selectedBannerImages = selectedBannerImages.map((img, idx) => ({
                  ...img,
                  isFeatured: idx === index
                }));
                updatePrimaryImage();
              }}
              class="px-2 py-1 text-xs rounded transition-colors {image.isFeatured ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
              title={image.isFeatured ? ui("Featured Image") : ui("Set as Featured")}
            >
              {image.isFeatured ? ui("⭐ Featured") : ui("Set Featured")}
            </button>
            
            <button
              type="button"
              onclick={() => {
                selectedBannerImages = selectedBannerImages.filter((_, idx) => idx !== index);
                applyPresetCollagePositions();
                updatePrimaryImage();
              }}
              class="ms-auto px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              title={ui("Remove image")}
            >
              ✕
            </button>
          </div>
          
          <!-- Controls Grid -->
          <div class="p-3 space-y-3">
            <!-- Orientation Controls -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="zoom-{index}" class="block text-xs text-gray-600 mb-1">
                  {ui("Zoom:")} {Math.round((image.zoom ?? bannerSettings.imageSize ?? 1.0) * 100)}%
                </label>
                <input
                  id="zoom-{index}"
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={image.zoom ?? bannerSettings.imageSize ?? 1.0}
                  oninput={(e) => {
                    selectedBannerImages[index] = {
                      ...selectedBannerImages[index],
                      zoom: parseFloat(e.target.value)
                    };
                    selectedBannerImages = [...selectedBannerImages];
                  }}
                  class="w-full"
                />
              </div>
              
              <div>
                <label for="opacity-{index}" class="block text-xs text-gray-600 mb-1">
                  {ui("Opacity:")} {Math.round((image.opacity ?? bannerSettings.imageOpacity ?? 1.0) * 100)}%
                </label>
                <input
                  id="opacity-{index}"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={image.opacity ?? bannerSettings.imageOpacity ?? 1.0}
                  oninput={(e) => {
                    selectedBannerImages[index] = {
                      ...selectedBannerImages[index],
                      opacity: parseFloat(e.target.value)
                    };
                    selectedBannerImages = [...selectedBannerImages];
                  }}
                  class="w-full"
                />
              </div>
            </div>
            
            <!-- Image Rotation (hidden for collage layouts, as layout position rotation is used instead) -->
            {#if bannerSettings.imageLayout !== 'collage'}
              <div>
                <label for="rotation-{index}" class="block text-xs text-gray-600 mb-1">
                  {ui("Rotation:")} {image.rotation ?? 0}°
                </label>
                <input
                  id="rotation-{index}"
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={image.rotation ?? 0}
                  oninput={(e) => {
                    selectedBannerImages[index] = {
                      ...selectedBannerImages[index],
                      rotation: parseInt(e.target.value)
                    };
                    selectedBannerImages = [...selectedBannerImages];
                  }}
                  class="w-full"
                />
              </div>
            {/if}
            
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={image.flipHorizontal ?? false}
                  onchange={(e) => {
                    selectedBannerImages[index] = {
                      ...selectedBannerImages[index],
                      flipHorizontal: e.target.checked
                    };
                    selectedBannerImages = [...selectedBannerImages];
                  }}
                  class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span class="text-xs text-gray-700">{ui("Flip Horizontal")}</span>
              </label>
              
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={image.flipVertical ?? false}
                  onchange={(e) => {
                    selectedBannerImages[index] = {
                      ...selectedBannerImages[index],
                      flipVertical: e.target.checked
                    };
                    selectedBannerImages = [...selectedBannerImages];
                  }}
                  class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span class="text-xs text-gray-700">{ui("Flip Vertical")}</span>
              </label>
            </div>
            
            <!-- Z-Index Control (for collage layouts) -->
            {#if bannerSettings.imageLayout === 'collage'}
              <div>
                <label for="zindex-{index}" class="block text-xs text-gray-600 mb-1">
                  {ui("Stack Order (Z-Index):")} {image.zIndex ?? index}
                  <span class="text-gray-400 ms-1">{ui("(Higher = on top)")}</span>
                </label>
                <input
                  id="zindex-{index}"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={image.zIndex ?? index}
                  oninput={(e) => {
                    selectedBannerImages[index] = {
                      ...selectedBannerImages[index],
                      zIndex: parseInt(e.target.value)
                    };
                    selectedBannerImages = [...selectedBannerImages];
                  }}
                  class="w-full"
                />
              </div>
            {/if}
            
            <!-- Layout Position Controls (for collage layouts) -->
            {#if bannerSettings.imageLayout === 'collage'}
              <div class="pt-2 border-t border-gray-200">
                <div class="text-xs font-medium text-gray-700 mb-2">{ui("Layout Position")}</div>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label for="pos-x-{index}" class="block text-[10px] text-gray-600 mb-0.5">X: {pos.x}%</label>
                    <input
                      id="pos-x-{index}"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={pos.x}
                      oninput={(e) => {
                        if (!bannerSettings.collageImagePositions[index]) {
                          bannerSettings.collageImagePositions[index] = { x: 50, y: 50, rotation: 0 };
                        }
                        bannerSettings.collageImagePositions[index].x = parseInt(e.target.value);
                        bannerSettings.collageImagePositions = [...bannerSettings.collageImagePositions];
                      }}
                      class="w-full"
                    />
                  </div>
                  <div>
                    <label for="pos-y-{index}" class="block text-[10px] text-gray-600 mb-0.5">Y: {pos.y}%</label>
                    <input
                      id="pos-y-{index}"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={pos.y}
                      oninput={(e) => {
                        if (!bannerSettings.collageImagePositions[index]) {
                          bannerSettings.collageImagePositions[index] = { x: 50, y: 50, rotation: 0 };
                        }
                        bannerSettings.collageImagePositions[index].y = parseInt(e.target.value);
                        bannerSettings.collageImagePositions = [...bannerSettings.collageImagePositions];
                      }}
                      class="w-full"
                    />
                  </div>
                  <div>
                    <label for="pos-rot-{index}" class="block text-[10px] text-gray-600 mb-0.5">{ui("Rotation:")} {pos.rotation}°</label>
                    <input
                      id="pos-rot-{index}"
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={pos.rotation || 0}
                      oninput={(e) => {
                        if (!bannerSettings.collageImagePositions[index]) {
                          bannerSettings.collageImagePositions[index] = { x: 50, y: 50, rotation: 0 };
                        }
                        bannerSettings.collageImagePositions[index].rotation = parseInt(e.target.value);
                        bannerSettings.collageImagePositions = [...bannerSettings.collageImagePositions];
                      }}
                      class="w-full"
                    />
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </CollapsibleSection>
{/if}

