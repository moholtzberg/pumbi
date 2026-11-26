<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let {
    generatedBannerUrl = null
  } = $props();
</script>

<div class="sticky top-4 h-fit">
  <h3 class="text-sm font-semibold text-gray-900 mb-3">{ui("Preview")}</h3>
  {#if generatedBannerUrl}
    <img
      src={generatedBannerUrl}
      alt={ui("Generated Banner")}
      class="w-full rounded-lg shadow-lg border border-gray-200"
    />
  {:else}
    <div class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
      <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-gray-600 text-sm">{ui("Configure settings and click \"Generate Banner\"")}</p>
    </div>
  {/if}
</div>

