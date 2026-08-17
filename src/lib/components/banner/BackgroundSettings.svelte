<script>
  import CollapsibleSection from './CollapsibleSection.svelte';
  
  let {
    bannerSettings = $bindable({}),
    backgroundTypes = [],
    updateGradientColor = () => {},
    isCollapsed = $bindable(true),
    selectedLotImages = [],
    type = 'lot',
    backgroundPresets = [],
    applyBackgroundPreset = () => {}
  } = $props();
  
  let backgroundImageSource = $state('url'); // 'url' or 'library'
  let showPresets = $state(false);
</script>

<CollapsibleSection
  title="Background"
  bind:isCollapsed
  bgColor="bg-blue-50"
  borderColor="border-blue-200"
  hoverColor="hover:bg-blue-100"
>
  <div class="space-y-3">
    {#if backgroundPresets && backgroundPresets.length > 0}
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="block text-xs font-medium text-gray-700">
            Background Designs
          </div>
          <button
            type="button"
            onclick={() => showPresets = !showPresets}
            class="text-xs text-purple-600 hover:text-purple-800 font-medium"
          >
            {showPresets ? 'Hide' : 'Show'} Presets
          </button>
        </div>
        {#if showPresets}
          <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200 mb-3">
            {#each backgroundPresets as preset}
              <button
                type="button"
                onclick={() => applyBackgroundPreset(preset)}
                class="p-2 text-left bg-white rounded border border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition-colors group"
                title={preset.description}
              >
                <div class="text-xs font-semibold text-gray-800 group-hover:text-purple-700 mb-0.5">
                  {preset.name}
                </div>
                <div class="text-xs text-gray-500 line-clamp-1">
                  {preset.description}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    
    <div>
      <label for="background-type" class="block text-xs font-medium text-gray-700 mb-1">
        Background Type
      </label>
      <select
        id="background-type"
        bind:value={bannerSettings.backgroundType}
        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {#each backgroundTypes as bgType}
          <option value={bgType.value}>{bgType.label}</option>
        {/each}
      </select>
    </div>
    
    {#if bannerSettings.backgroundType === 'solid'}
      <div>
        <label for="background-color" class="block text-xs font-medium text-gray-700 mb-1">
          Background Color
        </label>
        <div class="flex gap-2">
          <input
            id="background-color"
            type="color"
            bind:value={bannerSettings.backgroundColor}
            class="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
          />
          <input
            type="text"
            bind:value={bannerSettings.backgroundColor}
            placeholder="#F5F1E8"
            class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>
    {/if}
    
    {#if bannerSettings.backgroundType === 'gradient'}
      <div>
        <label for="gradient-type" class="block text-xs font-medium text-gray-700 mb-1">
          Gradient Type
        </label>
        <select
          id="gradient-type"
          bind:value={bannerSettings.backgroundGradient.type}
          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-3"
        >
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
        <div class="block text-xs font-medium text-gray-700 mb-2">Gradient Colors</div>
        <div class="grid grid-cols-2 gap-2">
          {#each bannerSettings.backgroundGradient.colors as color, index}
            <div>
              <label for="gradient-color-{index}" class="block text-xs text-gray-600 mb-1">Color {index + 1}</label>
              <div class="flex gap-2">
                <input
                  id="gradient-color-{index}"
                  type="color"
                  value={color}
                  oninput={(e) => updateGradientColor(index, e.target.value)}
                  class="h-10 w-16 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={color}
                  oninput={(e) => updateGradientColor(index, e.target.value)}
                  class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    {#if bannerSettings.backgroundType === 'image'}
      <div>
        {#if type === 'lot' && selectedLotImages.length > 0}
          <div class="mb-3">
            <div class="block text-xs font-medium text-gray-700 mb-2">
              Image Source
            </div>
            <div class="flex gap-2 mb-2">
              <button
                type="button"
                onclick={() => backgroundImageSource = 'library'}
                class="flex-1 px-3 py-1.5 text-xs rounded border transition-colors {backgroundImageSource === 'library' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
              >
                From Library
              </button>
              <button
                type="button"
                onclick={() => backgroundImageSource = 'url'}
                class="flex-1 px-3 py-1.5 text-xs rounded border transition-colors {backgroundImageSource === 'url' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
              >
                Custom URL
              </button>
            </div>
          </div>
        {/if}

        {#if backgroundImageSource === 'library' && type === 'lot' && selectedLotImages.length > 0}
          <div>
            <label for="background-image-library" class="block text-xs font-medium text-gray-700 mb-2">
              Select from Library
            </label>
            <div class="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto mb-2">
              {#each selectedLotImages as image}
                {@const isSelected = bannerSettings.backgroundImageUrl === (image.displayUrl || image.url)}
                <div
                  class="relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all {isSelected ? 'border-purple-600 ring-2 ring-purple-300' : 'border-gray-300 hover:border-purple-400'}"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    bannerSettings.backgroundImageUrl = image.displayUrl || image.url;
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      bannerSettings.backgroundImageUrl = image.displayUrl || image.url;
                    }
                  }}
                >
                  <img
                    src={image.displayUrl || image.url}
                    alt=""
                    class="w-full h-20 object-cover"
                    onerror={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  {#if isSelected}
                    <div class="absolute top-1 right-1 bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div>
            <label for="background-image-url" class="block text-xs font-medium text-gray-700 mb-1">
              Background Image URL
            </label>
            <input
              id="background-image-url"
              type="text"
              bind:value={bannerSettings.backgroundImageUrl}
              placeholder="https://example.com/image.jpg"
              class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
            />
            <p class="text-xs text-gray-500 mb-2">This image will be used as the full background</p>
          </div>
        {/if}

        {#if bannerSettings.backgroundImageUrl}
          <div class="mt-2 p-2 bg-white rounded border border-gray-200">
            <img
              src={bannerSettings.backgroundImageUrl}
              alt="Background preview"
              class="w-full h-24 object-cover rounded"
              onerror={(e) => {
                e.target.style.display = 'none';
                const errorDiv = e.target.nextElementSibling;
                if (errorDiv) errorDiv.style.display = 'block';
              }}
            />
            <div class="hidden text-xs text-red-500 text-center py-2">Failed to load image</div>
          </div>
        {/if}
      </div>
    {/if}
    
    {#if bannerSettings.backgroundType === 'pattern'}
      <div>
        <label for="background-pattern" class="block text-xs font-medium text-gray-700 mb-1">
          Pattern Style
        </label>
        <select
          id="background-pattern"
          bind:value={bannerSettings.backgroundPattern}
          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-3"
        >
          <option value="none">None</option>
          <option value="dots">Dots</option>
          <option value="lines">Lines</option>
          <option value="grid">Grid</option>
          <option value="diagonal">Diagonal</option>
          <option value="waves">Waves</option>
          <option value="circles">Circles</option>
          <option value="hexagons">Hexagons</option>
          <option value="crosshatch">Crosshatch</option>
          <option value="herringbone">Herringbone</option>
          <option value="stars">Stars</option>
          <option value="noise">Noise Texture</option>
        </select>
        {#if bannerSettings.backgroundPattern !== 'none'}
          <label for="pattern-background-color" class="block text-xs font-medium text-gray-700 mb-1">
            Pattern Base Color
          </label>
          <div class="flex gap-2">
            <input
              id="pattern-background-color"
              type="color"
              bind:value={bannerSettings.backgroundColor}
              class="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              bind:value={bannerSettings.backgroundColor}
              placeholder="#F5F1E8"
              class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        {/if}
      </div>
    {/if}
  </div>
</CollapsibleSection>

