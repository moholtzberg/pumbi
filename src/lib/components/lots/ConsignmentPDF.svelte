<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { getImageUrl } from '$lib/utils/imageUrl.js';
  import { onMount } from 'svelte';
  import ConsignorInfoForm from './ConsignorInfoForm.svelte';
  import ConsignmentOptions from './ConsignmentOptions.svelte';
  import ConsignmentDocument from './ConsignmentDocument.svelte';

  let {
    lot = null,
    auction = null,
    auctionHouse = null,
    onClose = () => {}
  } = $props();

  let consignorInfo = $state({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    signature: ''
  });

  let consignmentOptions = $state({
    reservePrice: false,
    minimumPrice: false,
    buyNowPrice: false,
    authentication: false,
    appraisal: false,
    restoration: false,
    insurance: false,
    shipping: false
  });

  let condition = $state('');
  let notes = $state('');
  let showPrintView = $state(false);
  let lotImageUrl = $state(null);
  let logoUrl = $state(null);
  let auctionHouseAddress = $state('');

  // Clean URL function to remove duplicate query parameters
  function cleanImageUrl(url) {
    if (!url) return url;
    
    // First, decode if it has encoded query parameters
    let cleanUrl = url;
    if (url.includes('%3F') || url.includes('%26')) {
      try {
        cleanUrl = decodeURIComponent(url);
      } catch (e) {
        // If decode fails, try to manually fix
        console.warn('URL decode failed, trying manual fix');
      }
    }
    
    // Remove duplicate query parameters - find the first ? and keep only that query string
    const firstQuestionMark = cleanUrl.indexOf('?');
    if (firstQuestionMark !== -1) {
      // Check if there's a second ? (duplicate)
      const secondQuestionMark = cleanUrl.indexOf('?', firstQuestionMark + 1);
      if (secondQuestionMark !== -1) {
        // Remove everything after the second ?
        cleanUrl = cleanUrl.substring(0, secondQuestionMark);
        console.log('[PDF] Removed duplicate query parameters from URL');
      }
    }
    
    return cleanUrl;
  }

  // Load images and address on mount
  onMount(async () => {
    // Load lot image
    const lotImages = getLotImages(lot);
    if (lotImages.length > 0) {
      try {
        const primaryImage = lotImages[0];
        const imageUrl = await getImageUrl(primaryImage);
        // Clean up duplicate query parameters
        lotImageUrl = cleanImageUrl(imageUrl);
      } catch (e) {
        console.warn('Could not load lot image:', e);
      }
    }

    // Load logo
    if (auctionHouse?.logoUrl) {
      try {
        const logoImageUrl = await getImageUrl(auctionHouse.logoUrl);
        logoUrl = cleanImageUrl(logoImageUrl);
      } catch (e) {
        console.warn('Could not load logo:', e);
      }
    }

    // Get auction house address
    if (auctionHouse?.settings) {
      try {
        const settings = JSON.parse(auctionHouse.settings);
        auctionHouseAddress = settings.addressInEnglish || '';
      } catch (e) {
        console.warn('Could not parse auction house settings');
      }
    }
  });

  function openPrintView() {
    if (!consignorInfo.name) {
      alert(ui("Please enter consignor name"));
      return;
    }
    showPrintView = true;
  }

  function getLotImages(lot) {
    if (lot.images && Array.isArray(lot.images)) {
      return lot.images.map(img => img.url || img);
    }
    if (lot.imageUrls) {
      try {
        const parsed = JSON.parse(lot.imageUrls);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    if (lot.imageUrl) {
      return [lot.imageUrl];
    }
    return [];
  }
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 print:hidden">
  <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-gray-900">{ui("Consignment Agreement - Lot #")}{lot?.lotNumber}</h2>
        <button
          onclick={onClose}
          class="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div class="space-y-6">
        <!-- Consignor Information -->
        <ConsignorInfoForm bind:consignorInfo />

        <!-- Condition -->
        <div>
          <label for="lot-condition" class="block text-sm font-medium text-gray-700 mb-1">{ui("Condition")}</label>
          <textarea
            id="lot-condition"
            bind:value={condition}
            rows="3"
            placeholder={ui("Describe the condition of the lot...")}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
        </div>

        <!-- Consignment Options -->
        <ConsignmentOptions bind:consignmentOptions />

        <!-- Additional Notes -->
        <div>
          <label for="additional-notes" class="block text-sm font-medium text-gray-700 mb-1">{ui("Additional Notes")}</label>
          <textarea
            id="additional-notes"
            bind:value={notes}
            rows="4"
            placeholder={ui("Any additional notes or special instructions...")}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button
            onclick={onClose}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            {ui("Cancel")}
          </button>
          <button
            onclick={openPrintView}
            disabled={!consignorInfo.name}
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {ui("Generate & Print PDF")}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Print View -->
<ConsignmentDocument
  {lot}
  {auction}
  {auctionHouse}
  {consignorInfo}
  {consignmentOptions}
  {condition}
  {notes}
  {lotImageUrl}
  {logoUrl}
  {auctionHouseAddress}
  bind:showPrintView
  {onClose}
/>

