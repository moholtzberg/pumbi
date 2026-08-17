<script>
  let { consignmentOptions = $bindable() } = $props();

  const options = [
    { key: 'reservePrice', label: 'Reserve Price' },
    { key: 'minimumPrice', label: 'Minimum Price' },
    { key: 'buyNowPrice', label: 'Buy Now Price' },
    { key: 'authentication', label: 'Authentication Required' },
    { key: 'appraisal', label: 'Appraisal Included' },
    { key: 'restoration', label: 'Restoration Allowed' },
    { key: 'insurance', label: 'Insurance Coverage' },
    { key: 'shipping', label: 'Shipping Arrangements' }
  ];
</script>

<div>
  <h3 class="text-lg font-semibold text-gray-900 mb-3">Consignment Options</h3>
  <div class="grid grid-cols-2 gap-3">
    {#each options as option}
      <label class="flex items-center">
        <input
          type="checkbox"
          bind:checked={consignmentOptions[option.key]}
          class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <span class="text-sm text-gray-700">{option.label}</span>
      </label>
    {/each}
  </div>
</div>



