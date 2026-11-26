<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let {
    generatingBanner = false,
    generatedBannerUrl = null,
    onGenerate = () => {},
    onDownload = () => {},
    canGenerate = true
  } = $props();
</script>

<div class="space-y-2 mt-3">
  <button
    onclick={onGenerate}
    disabled={generatingBanner || !canGenerate}
    class="w-full bg-purple-600 text-white py-2 text-sm rounded hover:bg-purple-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
  >
    {generatingBanner ? ui("Generating...") : ui("Generate Banner")}
  </button>
  
  {#if generatedBannerUrl}
    <button
      onclick={onDownload}
      class="w-full bg-green-600 text-white py-2 text-sm rounded hover:bg-green-700 transition-colors font-semibold"
    >
      {ui("Download Banner")}
    </button>
  {/if}
</div>

