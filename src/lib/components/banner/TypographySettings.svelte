<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import CollapsibleSection from './CollapsibleSection.svelte';
  
  let {
    bannerSettings = $bindable({}),
    fonts = [],
    hebrewFonts = [],
    convertToHebrewYear = () => '',
    isCollapsed = $bindable(true)
  } = $props();
</script>

<CollapsibleSection
  title={ui("Typography")}
  bind:isCollapsed
  bgColor="bg-gray-50"
  borderColor="border-gray-200"
  hoverColor="hover:bg-gray-100"
>
  <div class="space-y-3">
    <div>
      <label for="font-family" class="block text-xs font-medium text-gray-700 mb-1">
        {ui("English Font")}
      </label>
      <select
        id="font-family"
        bind:value={bannerSettings.fontFamily}
        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {#each fonts as font}
          <option value={font.value}>{font.name}</option>
        {/each}
      </select>
    </div>
    
    <div>
      <label for="hebrew-font-family" class="block text-xs font-medium text-gray-700 mb-1">
        {ui("Hebrew Font")}
      </label>
      <select
        id="hebrew-font-family"
        bind:value={bannerSettings.hebrewFontFamily}
        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {#each hebrewFonts as font}
          <option value={font.value}>{font.name}</option>
        {/each}
      </select>
    </div>
    
    <div>
      <label for="text-color" class="block text-xs font-medium text-gray-700 mb-1">
        {ui("Text Color")}
      </label>
      <input
        id="text-color"
        type="color"
        bind:value={bannerSettings.textColor}
        class="w-full h-12 border border-gray-300 rounded-lg"
      />
    </div>
    
    <div class="pt-2 border-t border-gray-200">
      <div class="text-xs font-medium text-gray-700 mb-2">{ui("Spacing")}</div>
      
      <div>
        <label for="text-spacing-title" class="block text-xs text-gray-600 mb-1">
          {ui("Title Spacing:")} {bannerSettings.textSpacingTitle ?? 20}px
        </label>
        <input
          id="text-spacing-title"
          type="range"
          min="0"
          max="100"
          step="5"
          value={bannerSettings.textSpacingTitle ?? 20}
          oninput={(e) => bannerSettings.textSpacingTitle = parseInt(e.target.value)}
          class="w-full"
        />
        <p class="text-xs text-gray-500 mt-1">{ui("Spacing after title")}</p>
      </div>
      
      <div>
        <label for="text-spacing-year" class="block text-xs text-gray-600 mb-1">
          {ui("Year Spacing:")} {bannerSettings.textSpacingYear ?? 20}px
        </label>
        <input
          id="text-spacing-year"
          type="range"
          min="0"
          max="100"
          step="5"
          value={bannerSettings.textSpacingYear ?? 20}
          oninput={(e) => bannerSettings.textSpacingYear = parseInt(e.target.value)}
          class="w-full"
        />
        <p class="text-xs text-gray-500 mt-1">{ui("Spacing after year")}</p>
      </div>
      
      <div>
        <label for="text-spacing-subtitle" class="block text-xs text-gray-600 mb-1">
          {ui("Subtitle Spacing:")} {bannerSettings.textSpacingSubtitle ?? 10}px
        </label>
        <input
          id="text-spacing-subtitle"
          type="range"
          min="0"
          max="100"
          step="5"
          value={bannerSettings.textSpacingSubtitle ?? 10}
          oninput={(e) => bannerSettings.textSpacingSubtitle = parseInt(e.target.value)}
          class="w-full"
        />
        <p class="text-xs text-gray-500 mt-1">{ui("Spacing after subtitle")}</p>
      </div>
      
      <div>
        <label for="text-line-height" class="block text-xs text-gray-600 mb-1">
          {ui("Line Height Multiplier:")} {(bannerSettings.textLineHeight ?? 1.2).toFixed(1)}x
        </label>
        <input
          id="text-line-height"
          type="range"
          min="0.8"
          max="2.5"
          step="0.1"
          value={bannerSettings.textLineHeight ?? 1.2}
          oninput={(e) => bannerSettings.textLineHeight = parseFloat(e.target.value)}
          class="w-full"
        />
        <p class="text-xs text-gray-500 mt-1">{ui("Spacing between lines of text")}</p>
      </div>
    </div>
  </div>
</CollapsibleSection>

