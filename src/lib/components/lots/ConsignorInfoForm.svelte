<script>
  let { consignorInfo = $bindable() } = $props();
</script>

<div>
  <h3 class="text-lg font-semibold text-gray-900 mb-3">Consignor Information</h3>
  <div class="grid grid-cols-2 gap-4">
    <div>
      <label for="consignor-name" class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
      <input
        id="consignor-name"
        type="text"
        bind:value={consignorInfo.name}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        required
      />
    </div>
    <div>
      <label for="consignor-phone" class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
      <input
        id="consignor-phone"
        type="tel"
        bind:value={consignorInfo.phone}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
    <div class="col-span-2">
      <label for="consignor-address" class="block text-sm font-medium text-gray-700 mb-1">Address</label>
      <input
        id="consignor-address"
        type="text"
        bind:value={consignorInfo.address}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
    <div>
      <label for="consignor-city" class="block text-sm font-medium text-gray-700 mb-1">City</label>
      <input
        id="consignor-city"
        type="text"
        bind:value={consignorInfo.city}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
    <div>
      <label for="consignor-state" class="block text-sm font-medium text-gray-700 mb-1">State</label>
      <input
        id="consignor-state"
        type="text"
        bind:value={consignorInfo.state}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
    <div>
      <label for="consignor-zip" class="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
      <input
        id="consignor-zip"
        type="text"
        bind:value={consignorInfo.zipCode}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
    <div>
      <label for="consignor-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
      <input
        id="consignor-email"
        type="email"
        bind:value={consignorInfo.email}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  </div>
</div>



