<script>
  import CollapsibleSection from './CollapsibleSection.svelte';
  
  let {
    bannerSettings = $bindable({}),
    convertToHebrewYear = () => '',
    isCollapsed = $bindable(true)
  } = $props();
</script>

<CollapsibleSection
  title="Text Content"
  bind:isCollapsed
  bgColor="bg-green-50"
  borderColor="border-green-200"
  hoverColor="hover:bg-green-100"
>
  <div class="space-y-4">
    <!-- Title English -->
    <div class="space-y-2">
      <label for="title-en" class="block text-xs font-medium text-gray-700 mb-1">
        Title (English)
      </label>
      <div class="grid grid-cols-3 gap-2">
        <textarea
          id="title-en"
          bind:value={bannerSettings.title}
          placeholder="Banner title (press Enter for new line)"
          rows="2"
          class="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
        ></textarea>
        <div class="flex gap-1">
          <input
            type="number"
            bind:value={bannerSettings.titleEnglishFontSize}
            min="12"
            max="120"
            step="1"
            class="w-16 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Font Size"
          />
          <select
            bind:value={bannerSettings.titleEnglishAlign}
            class="flex-1 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Text Alignment"
          >
            <option value="left">L</option>
            <option value="center">C</option>
            <option value="right">R</option>
          </select>
        </div>
      </div>
      <p class="text-xs text-gray-500">Press Enter to create a new line</p>
    </div>
    
    <!-- Title Hebrew -->
    <div class="space-y-2">
      <label for="title-he" class="block text-xs font-medium text-gray-700 mb-1">
        Title (Hebrew)
      </label>
      <div class="grid grid-cols-3 gap-2">
        <textarea
          id="title-he"
          bind:value={bannerSettings.titleHebrew}
          placeholder="כותרת בעברית (לחץ Enter לשורה חדשה)"
          rows="2"
          dir="rtl"
          class="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
        ></textarea>
        <div class="flex gap-1">
          <input
            type="number"
            bind:value={bannerSettings.titleHebrewFontSize}
            min="12"
            max="120"
            step="1"
            class="w-16 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Font Size"
          />
          <select
            bind:value={bannerSettings.titleHebrewAlign}
            class="flex-1 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Text Alignment"
          >
            <option value="left">L</option>
            <option value="center">C</option>
            <option value="right">R</option>
          </select>
        </div>
      </div>
      <p class="text-xs text-gray-500">Press Enter to create a new line</p>
    </div>
    
    <!-- Text Separator -->
    <div class="pt-2 border-t border-gray-200 space-y-2">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={bannerSettings.textSeparatorEnabled}
          class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
        />
        <span class="text-xs font-medium text-gray-700">Enable Text Separator</span>
      </label>
      
      {#if bannerSettings.textSeparatorEnabled}
        <div class="space-y-2 pl-6">
          <div>
            <label for="text-separator-style" class="block text-xs font-medium text-gray-700 mb-1">
              Separator Style
            </label>
            <select
              id="text-separator-style"
              bind:value={bannerSettings.textSeparatorStyle}
              class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="line">Line</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double Line</option>
              <option value="diamond">Diamond</option>
              <option value="circle">Circle</option>
              <option value="square">Square</option>
            </select>
          </div>
          
          <div>
            <label for="text-separator-position" class="block text-xs font-medium text-gray-700 mb-1">
              Position
            </label>
            <select
              id="text-separator-position"
              bind:value={bannerSettings.textSeparatorPosition}
              class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="below-english">Below English Title</option>
              <option value="below-hebrew">Below Hebrew Title</option>
            </select>
          </div>
          
          <div>
            <label for="text-separator-width" class="block text-xs font-medium text-gray-700 mb-1">
              Width: {bannerSettings.textSeparatorWidth || 60}%
            </label>
            <input
              id="text-separator-width"
              type="range"
              min="20"
              max="100"
              step="5"
              bind:value={bannerSettings.textSeparatorWidth}
              class="w-full"
            />
          </div>
          
          <div>
            <label for="text-separator-thickness" class="block text-xs font-medium text-gray-700 mb-1">
              Thickness: {bannerSettings.textSeparatorThickness || 2}px
            </label>
            <input
              id="text-separator-thickness"
              type="range"
              min="1"
              max="10"
              step="1"
              bind:value={bannerSettings.textSeparatorThickness}
              class="w-full"
            />
          </div>
          
          <div>
            <label for="text-separator-align" class="block text-xs font-medium text-gray-700 mb-1">
              Alignment
            </label>
            <select
              id="text-separator-align"
              bind:value={bannerSettings.textSeparatorAlign}
              class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="text-separator-margin-top" class="block text-xs font-medium text-gray-700 mb-1">
                Margin Above: {bannerSettings.textSeparatorMarginTop || 10}px
              </label>
              <input
                id="text-separator-margin-top"
                type="range"
                min="0"
                max="50"
                step="5"
                bind:value={bannerSettings.textSeparatorMarginTop}
                class="w-full"
              />
            </div>
            
            <div>
              <label for="text-separator-margin-bottom" class="block text-xs font-medium text-gray-700 mb-1">
                Margin Below: {bannerSettings.textSeparatorMarginBottom || 15}px
              </label>
              <input
                id="text-separator-margin-bottom"
                type="range"
                min="0"
                max="50"
                step="5"
                bind:value={bannerSettings.textSeparatorMarginBottom}
                class="w-full"
              />
            </div>
          </div>
          
          <div>
            <label for="text-separator-color" class="block text-xs font-medium text-gray-700 mb-1">
              Color
            </label>
            <div class="flex gap-2">
              <input
                id="text-separator-color"
                type="color"
                value={bannerSettings.textSeparatorColor || bannerSettings.textColor}
                oninput={(e) => bannerSettings.textSeparatorColor = e.target.value}
                class="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                bind:value={bannerSettings.textSeparatorColor}
                placeholder="Uses text color if empty"
                class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="button"
                onclick={() => bannerSettings.textSeparatorColor = ''}
                class="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                title="Reset to text color"
              >
                Reset
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">Leave empty to use the main text color</p>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Subtitle English -->
    <div class="space-y-2">
      <label for="subtitle-en" class="block text-xs font-medium text-gray-700 mb-1">
        Subtitle (English)
      </label>
      <div class="grid grid-cols-3 gap-2">
        <textarea
          id="subtitle-en"
          bind:value={bannerSettings.subtitle}
          placeholder="Banner subtitle"
          rows="2"
          class="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        ></textarea>
        <div class="flex gap-1">
          <input
            type="number"
            bind:value={bannerSettings.subtitleEnglishFontSize}
            min="12"
            max="120"
            step="1"
            class="w-16 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Font Size"
          />
          <select
            bind:value={bannerSettings.subtitleEnglishAlign}
            class="flex-1 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Text Alignment"
          >
            <option value="left">L</option>
            <option value="center">C</option>
            <option value="right">R</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- Subtitle Hebrew -->
    <div class="space-y-2">
      <label for="subtitle-he" class="block text-xs font-medium text-gray-700 mb-1">
        Subtitle (Hebrew)
      </label>
      <div class="grid grid-cols-3 gap-2">
        <textarea
          id="subtitle-he"
          bind:value={bannerSettings.subtitleHebrew}
          placeholder="תת-כותרת בעברית"
          rows="2"
          dir="rtl"
          class="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        ></textarea>
        <div class="flex gap-1">
          <input
            type="number"
            bind:value={bannerSettings.subtitleHebrewFontSize}
            min="12"
            max="120"
            step="1"
            class="w-16 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Font Size"
          />
          <select
            bind:value={bannerSettings.subtitleHebrewAlign}
            class="flex-1 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Text Alignment"
          >
            <option value="left">L</option>
            <option value="center">C</option>
            <option value="right">R</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- Year English -->
    <div class="space-y-2">
      <label for="year-en" class="block text-xs font-medium text-gray-700 mb-1">
        Year (English)
      </label>
      <div class="grid grid-cols-3 gap-2">
        <input
          id="year-en"
          type="text"
          bind:value={bannerSettings.yearEnglish}
          placeholder="e.g., 1890"
          oninput={(e) => {
            bannerSettings.yearEnglish = e.target.value;
            if (bannerSettings.yearEnglish) {
              bannerSettings.yearHebrew = convertToHebrewYear(bannerSettings.yearEnglish);
            } else {
              bannerSettings.yearHebrew = '';
            }
          }}
          class="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <div class="flex gap-1">
          <input
            type="number"
            bind:value={bannerSettings.yearEnglishFontSize}
            min="12"
            max="120"
            step="1"
            class="w-16 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Font Size"
          />
          <select
            bind:value={bannerSettings.yearEnglishAlign}
            class="flex-1 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Text Alignment"
          >
            <option value="left">L</option>
            <option value="center">C</option>
            <option value="right">R</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- Year Hebrew -->
    <div class="space-y-2">
      <label for="year-he" class="block text-xs font-medium text-gray-700 mb-1">
        Year (Hebrew)
      </label>
      <div class="grid grid-cols-3 gap-2">
        <input
          id="year-he"
          type="text"
          bind:value={bannerSettings.yearHebrew}
          placeholder="Auto-filled from English year, or enter manually"
          dir="rtl"
          class="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <div class="flex gap-1">
          <input
            type="number"
            bind:value={bannerSettings.yearHebrewFontSize}
            min="12"
            max="120"
            step="1"
            class="w-16 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Font Size"
          />
          <select
            bind:value={bannerSettings.yearHebrewAlign}
            class="flex-1 px-1 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            title="Text Alignment"
          >
            <option value="left">L</option>
            <option value="center">C</option>
            <option value="right">R</option>
          </select>
        </div>
      </div>
      <p class="text-xs text-gray-500">Auto-converts from English year, or enter manually</p>
    </div>
    
    <div class="pt-2 border-t border-gray-200">
      <div class="space-y-2">
        <div>
          <label for="ribbon-en" class="block text-xs font-medium text-gray-700 mb-1">
            Ribbon Text (English)
          </label>
          <input
            id="ribbon-en"
            type="text"
            bind:value={bannerSettings.category}
            placeholder="e.g., Paintings, Sculpture, etc."
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label for="ribbon-he" class="block text-xs font-medium text-gray-700 mb-1">
            Ribbon Text (Hebrew)
          </label>
          <input
            id="ribbon-he"
            type="text"
            bind:value={bannerSettings.categoryHebrew}
            placeholder="קטגוריה בעברית"
            dir="rtl"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label for="ribbon-position" class="block text-xs font-medium text-gray-700 mb-1">
            Ribbon Position
          </label>
          <select
            id="ribbon-position"
            bind:value={bannerSettings.ribbonPosition}
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="right">Top Right</option>
            <option value="left">Top Left</option>
          </select>
        </div>
        
        <div>
          <label for="ribbon-color" class="block text-xs font-medium text-gray-700 mb-1">
            Ribbon Color
          </label>
          <div class="flex gap-2">
            <input
              id="ribbon-color"
              type="color"
              bind:value={bannerSettings.ribbonColor}
              class="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              bind:value={bannerSettings.ribbonColor}
              placeholder="#DC2626"
              class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <p class="text-xs text-gray-500 mt-1">Color of the ribbon (text will be white)</p>
        </div>
        
        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={bannerSettings.showBottomBorder}
              class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <span class="text-xs font-medium text-gray-700">Show Bottom Border</span>
          </label>
          <p class="text-xs text-gray-500 mt-1 ml-6">Display auction house name, auction name, and date at the bottom</p>
        </div>

        {#if bannerSettings.showBottomBorder}
          <div class="space-y-2">
            <div>
              <label for="bottom-border-color" class="block text-xs font-medium text-gray-700 mb-1">
                Border Color
              </label>
              <div class="flex gap-2">
                <input
                  id="bottom-border-color"
                  type="color"
                  bind:value={bannerSettings.bottomBorderColor}
                  class="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  bind:value={bannerSettings.bottomBorderColor}
                  placeholder="#2563EB"
                  class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label for="bottom-border-position" class="block text-xs font-medium text-gray-700 mb-1">
                Border Position
              </label>
              <select
                id="bottom-border-position"
                bind:value={bannerSettings.bottomBorderPosition}
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
            
            <div>
              <label for="bottom-border-width" class="block text-xs font-medium text-gray-700 mb-1">
                Border {bannerSettings.bottomBorderPosition === 'left' || bannerSettings.bottomBorderPosition === 'right' ? 'Width' : 'Height'}: {bannerSettings.bottomBorderHeight}px
              </label>
              <input
                id="bottom-border-width"
                type="range"
                min="30"
                max="150"
                step="5"
                bind:value={bannerSettings.bottomBorderHeight}
                class="w-full"
              />
              <p class="text-xs text-gray-500 mt-1">
                {bannerSettings.bottomBorderPosition === 'left' || bannerSettings.bottomBorderPosition === 'right' 
                  ? 'Width of the vertical border' 
                  : 'Height of the horizontal border'}
              </p>
            </div>
            
            <div>
              <label for="bottom-border-text-align" class="block text-xs font-medium text-gray-700 mb-1">
                Text Alignment
              </label>
              <select
                id="bottom-border-text-align"
                bind:value={bannerSettings.bottomBorderTextAlign}
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">
                {bannerSettings.bottomBorderPosition === 'left' || bannerSettings.bottomBorderPosition === 'right'
                  ? 'Vertical alignment for rotated text'
                  : 'Horizontal alignment for text'}
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</CollapsibleSection>
