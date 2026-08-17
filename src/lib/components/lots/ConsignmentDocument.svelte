<script>
  let {
    lot = null,
    auction = null,
    auctionHouse = null,
    consignorInfo = {},
    consignmentOptions = {},
    condition = '',
    notes = '',
    lotImageUrl = null,
    logoUrl = null,
    auctionHouseAddress = '',
    showPrintView = $bindable(false),
    onClose = () => {}
  } = $props();

  function printPDF() {
    window.print();
  }
</script>

{#if showPrintView}
  <div class="fixed inset-0 bg-white z-[60] print:relative print:inset-auto print:top-0 print:left-0 print:w-full print:h-auto overflow-auto" id="print-view">
    <style>
      /* @media print {
        @page {
          margin: 0.5in;
          size: letter;
        }
        
        body * {
          visibility: hidden;
        }
        #print-view, #print-view * {
          visibility: visible;
        }
      } */
    </style>
    
    <!-- Print Controls (hidden when printing) -->
    <div class="print:hidden bg-gray-100 p-4 border-b flex justify-between items-center">
      <h3 class="text-lg font-semibold">Consignment Agreement Preview</h3>
      <div class="flex gap-3">
        <button
          onclick={() => showPrintView = false}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 border border-gray-300"
        >
          Close
        </button>
        <button
          onclick={printPDF}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Print to PDF
        </button>
      </div>
    </div>

    <!-- Document Content -->
    <div class="bg-white p-8 max-w-4xl mx-auto print:p-0 print:max-w-full" style="font-family: 'Times New Roman', serif;">
      <!-- Letterhead -->
      <div class="mb-8">
        <div class="flex justify-between items-start mb-6">
          {#if logoUrl}
            <div>
              <img src={logoUrl} alt="{auctionHouse?.name || 'Auction House'} Logo" class="h-12 object-contain" />
            </div>
          {/if}
          <div class="text-right">
            <h1 class="text-xl font-bold mb-2">{auctionHouse?.name || 'Auction House'}</h1>
            {#if auctionHouseAddress}
              <div class="text-sm text-gray-600 whitespace-pre-line">{auctionHouseAddress}</div>
            {/if}
          </div>
        </div>
        <hr class="border-gray-300 my-4" />
      </div>

      <!-- Title -->
      <div class="text-center mb-4 print:break-inside-avoid">
        <h2 class="text-2xl font-bold mb-2 print:break-after-avoid">CONSIGNMENT AGREEMENT</h2>
        <!-- <p class="text-gray-600">Lot Consignment Documentation</p> -->
      </div>

      <hr class="border-gray-300 my-6" />

      <!-- Consignor Information -->
      <div class="mb-6 print:break-inside-avoid">
        <h3 class="text-lg font-bold mb-3 print:break-after-avoid">Consignor Information:</h3>
        <div class="space-y-2 text-sm">
          <p class="print:[orphans:3] print:[widows:3]"><strong>Name:</strong> {consignorInfo.name || '___________________'}</p>
          <p class="print:[orphans:3] print:[widows:3]"><strong>Address:</strong> {consignorInfo.address || '___________________'}</p>
          <p class="print:[orphans:3] print:[widows:3]"><strong>City, State, ZIP:</strong> {consignorInfo.city || ''}{consignorInfo.state ? ', ' + consignorInfo.state : ''} {consignorInfo.zipCode || ''}</p>
          <p class="print:[orphans:3] print:[widows:3]"><strong>Phone:</strong> {consignorInfo.phone || '___________________'}</p>
          <p class="print:[orphans:3] print:[widows:3]"><strong>Email:</strong> {consignorInfo.email || '___________________'}</p>
        </div>
      </div>

      <!-- Lot Information in Table -->
      <div class="mb-6 print:break-inside-avoid">
        <h3 class="text-lg font-bold mb-3 print:break-after-avoid">Lot Information:</h3>
        <table class="w-full border-collapse border border-gray-300 text-sm print:break-inside-avoid">
          <tbody>
            <tr>
              <!-- Lot Image Column -->
              {#if lotImageUrl}
                <td class="border border-gray-300 p-4 align-top w-1/3 print:align-top">
                  <div class="text-center">
                    <img src={lotImageUrl} alt="Lot {lot?.lotNumber || ''}" class="max-w-full h-auto border border-gray-300 rounded print:max-w-[200px] mx-auto" />
                    <p class="text-xs text-gray-500 italic mt-2">Lot {lot?.lotNumber || ''}</p>
                  </div>
                </td>
              {/if}
              <!-- Lot Details Column -->
              <td class="border border-gray-300 p-4 align-top {lotImageUrl ? 'w-2/3' : 'w-full'}">
                <div class="space-y-2">
                  <p class="print:[orphans:3] print:[widows:3]"><strong>Lot Number:</strong> {lot?.lotNumber}</p>
                  <p class="print:[orphans:3] print:[widows:3]"><strong>Auction:</strong> {auction?.title || ''}</p>
                  <p class="print:[orphans:3] print:[widows:3]"><strong>Title:</strong> {lot?.title || ''}</p>
                  {#if lot?.hebrewTitle}
                    <p class="print:[orphans:3] print:[widows:3]"><strong>Hebrew Title:</strong> {lot.hebrewTitle}</p>
                  {/if}
                  {#if lot?.description}
                    <div class="print:[orphans:3] print:[widows:3]">
                      <strong>Description:</strong>
                      <p class="ml-4 mt-1">{lot.description}</p>
                    </div>
                  {/if}
                  {#if lot?.category}
                    <p class="print:[orphans:3] print:[widows:3]"><strong>Category:</strong> {lot.category}</p>
                  {/if}
                  <p class="print:[orphans:3] print:[widows:3]"><strong>Starting Bid:</strong> ${lot?.startingBid?.toFixed(2) || '0.00'}</p>
                  {#if condition}
                    <p class="print:[orphans:3] print:[widows:3]"><strong>Condition:</strong> {condition}</p>
                  {/if}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Consignment Options -->
      <div class="mb-6 print:break-inside-avoid">
        <h3 class="text-lg font-bold mb-3 print:break-after-avoid">Consignment Options:</h3>
        <div class="grid grid-cols-2 gap-2 text-sm">
          {#each [
            { key: 'reservePrice', label: 'Reserve Price' },
            { key: 'minimumPrice', label: 'Minimum Price' },
            { key: 'buyNowPrice', label: 'Buy Now Price' },
            { key: 'authentication', label: 'Authentication Required' },
            { key: 'appraisal', label: 'Appraisal Included' },
            { key: 'restoration', label: 'Restoration Allowed' },
            { key: 'insurance', label: 'Insurance Coverage' },
            { key: 'shipping', label: 'Shipping Arrangements' }
          ] as option}
            <div class="print:[orphans:3] print:[widows:3]">{consignmentOptions[option.key] ? '☑' : '☐'} {option.label}</div>
          {/each}
        </div>
      </div>

      <!-- Additional Notes -->
      {#if notes}
        <div class="mb-6 print:break-inside-avoid">
          <h3 class="text-lg font-bold mb-3 print:break-after-avoid">Additional Notes:</h3>
          <p class="text-sm whitespace-pre-line print:[orphans:3] print:[widows:3]">{notes}</p>
        </div>
      {/if}

      <!-- Consignment Terms -->
      <div class="mb-6 print:break-inside-avoid">
        <h3 class="text-lg font-bold mb-3 print:break-after-avoid">Consignment Terms and Conditions:</h3>
        <ol class="list-decimal list-inside space-y-2 text-xs">
          <li class="print:[orphans:3] print:[widows:3]">The consignor agrees to consign the above-described lot to the auction house for sale at auction.</li>
          <li class="print:[orphans:3] print:[widows:3]">The auction house will use its best efforts to sell the lot at the highest possible price.</li>
          <li class="print:[orphans:3] print:[widows:3]">The consignor agrees to pay a commission as agreed upon separately.</li>
          <li class="print:[orphans:3] print:[widows:3]">The auction house reserves the right to set a reserve price if not specified.</li>
          <li class="print:[orphans:3] print:[widows:3]">The consignor warrants that they have clear title to the lot and the right to consign it.</li>
          <li class="print:[orphans:3] print:[widows:3]">The consignor is responsible for accurate description of the lot's condition.</li>
          <li class="print:[orphans:3] print:[widows:3]">The auction house is not responsible for loss or damage to the lot while in its possession, except as may be covered by insurance.</li>
          <li class="print:[orphans:3] print:[widows:3]">Payment to the consignor will be made within 30 days of the sale, less commission and fees.</li>
          <li class="print:[orphans:3] print:[widows:3]">If the lot does not sell, it may be returned to the consignor at their expense or held for a future auction.</li>
          <li class="print:[orphans:3] print:[widows:3]">This agreement is subject to the auction house's standard terms and conditions.</li>
        </ol>
      </div>

      <!-- Signature Lines -->
      <div class="mt-8 space-y-4 text-sm print:break-inside-avoid">
        <p class="print:[orphans:3] print:[widows:3]">Consignor Signature: ___________________</p>
        <p class="print:[orphans:3] print:[widows:3]">Date: ___________________</p>
        <p class="print:[orphans:3] print:[widows:3]">Auction House Representative: ___________________</p>
        <p class="print:[orphans:3] print:[widows:3]">Date: ___________________</p>
      </div>

      <!-- Footer -->
      <div class="mt-12 pt-4 border-t border-gray-300 text-center text-xs text-gray-600 print:mt-8 print:break-inside-avoid">
        {#if auctionHouseAddress}
          <div class="mb-2">{auctionHouseAddress}</div>
        {/if}
        <div class="text-right">Page 1</div>
      </div>
    </div>
  </div>
{/if}



