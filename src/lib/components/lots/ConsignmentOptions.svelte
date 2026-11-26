<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let { consignmentOptions = $bindable() } = $props();

  const options = [
    { key: 'reservePrice', label: ui("Reserve Price") },
    { key: 'minimumPrice', label: ui("Minimum Price") },
    { key: 'buyNowPrice', label: ui("Buy Now Price") },
    { key: 'authentication', label: ui("Authentication Required") },
    { key: 'appraisal', label: ui("Appraisal Included") },
    { key: 'restoration', label: ui("Restoration Allowed") },
    { key: 'insurance', label: ui("Insurance Coverage") },
    { key: 'shipping', label: ui("Shipping Arrangements") }
  ];
</script>

<div>
  <h3 class="text-lg font-semibold text-gray-900 mb-3">{ui("Consignment Options")}</h3>
  <div class="grid grid-cols-2 gap-3">
    {#each options as option}
      <label class="flex items-center">
        <input
          type="checkbox"
          bind:checked={consignmentOptions[option.key]}
          class="me-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">{option.label}</span>
      </label>
    {/each}
  </div>
</div>



