<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import CollapsibleSection from './CollapsibleSection.svelte';
  
  let {
    bannerSettings = $bindable({}),
    isCollapsed = $bindable(true)
  } = $props();
</script>

<CollapsibleSection
  title={ui("Image Shadows")}
  bind:isCollapsed
  bgColor="bg-gray-50"
  borderColor="border-gray-200"
  hoverColor="hover:bg-gray-100"
>
  <div class="p-3 space-y-3">
    <div class="mb-3 flex items-center">
      <input
        id="image-shadow-enabled"
        type="checkbox"
        bind:checked={bannerSettings.imageShadowEnabled}
        class="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
      />
      <label for="image-shadow-enabled" class="ms-2 block text-xs font-medium text-gray-700">
        {ui("Enable Image Shadows")}
      </label>
    </div>

    {#if bannerSettings.imageShadowEnabled}
      <div class="mb-3">
        <label for="image-shadow-color" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Shadow Color")}
        </label>
        <div class="flex gap-2">
          <input
            id="image-shadow-color"
            type="color"
            bind:value={bannerSettings.imageShadowColor}
            class="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
          />
          <input
            type="text"
            bind:value={bannerSettings.imageShadowColor}
            placeholder="rgba(0, 0, 0, 0.3)"
            class="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <div class="mb-3">
        <label for="image-shadow-blur" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Shadow Blur:")} {bannerSettings.imageShadowBlur}px
        </label>
        <input
          id="image-shadow-blur"
          type="range"
          min="0"
          max="50"
          bind:value={bannerSettings.imageShadowBlur}
          class="w-full"
        />
      </div>

      <div class="mb-3">
        <label for="image-shadow-offset-x" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Shadow Offset X:")} {bannerSettings.imageShadowOffsetX}px
        </label>
        <input
          id="image-shadow-offset-x"
          type="range"
          min="-20"
          max="20"
          bind:value={bannerSettings.imageShadowOffsetX}
          class="w-full"
        />
      </div>

      <div class="mb-3">
        <label for="image-shadow-offset-y" class="block text-xs font-medium text-gray-700 mb-1">
          {ui("Shadow Offset Y:")} {bannerSettings.imageShadowOffsetY}px
        </label>
        <input
          id="image-shadow-offset-y"
          type="range"
          min="-20"
          max="20"
          bind:value={bannerSettings.imageShadowOffsetY}
          class="w-full"
        />
      </div>
    {/if}
  </div>
</CollapsibleSection>

