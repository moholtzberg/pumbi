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
  
  // Available field mappings
  const fieldMappings = [
    { value: 'title', label: ui("Title (English)") },
    { value: 'titleHebrew', label: ui("Title (Hebrew)") },
    { value: 'subtitle', label: ui("Subtitle (English)") },
    { value: 'subtitleHebrew', label: ui("Subtitle (Hebrew)") },
    { value: 'yearEnglish', label: ui("Year (English)") },
    { value: 'yearHebrew', label: ui("Year (Hebrew)") },
    { value: 'category', label: ui("Category (English)") },
    { value: 'categoryHebrew', label: ui("Category (Hebrew)") },
    { value: 'custom', label: ui("Custom Text") },
  ];
  
  function addTextElement() {
    const newId = `text${bannerSettings.textElements.length + 1}`;
    const newOrder = Math.max(...bannerSettings.textElements.map(e => e.order), 0) + 1;
    bannerSettings.textElements = [
      ...bannerSettings.textElements,
      {
        id: newId,
        label: ui("Text Element {value0}", { value0: bannerSettings.textElements.length + 1 }),
        content: '',
        mappedField: 'custom',
        enabled: true,
        order: newOrder,
        fontSize: 42,
        fontFamily: 'Cormorant Garamond, Times New Roman, serif',
        language: 'english',
        fontWeight: 'normal',
        color: '#2C1810',
        align: 'center',
        marginTop: 0,
        marginBottom: 20,
        marginLeft: 0,
        marginRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        lineHeight: 1.2,
        positionY: null,
      }
    ];
  }
  
  function removeTextElement(index) {
    bannerSettings.textElements = bannerSettings.textElements.filter((_, i) => i !== index);
    // Reorder remaining elements
    bannerSettings.textElements.forEach((el, i) => {
      el.order = i + 1;
    });
  }
  
  function moveElement(index, direction) {
    if (direction === 'up' && index > 0) {
      const elements = [...bannerSettings.textElements];
      [elements[index].order, elements[index - 1].order] = [elements[index - 1].order, elements[index].order];
      bannerSettings.textElements = elements.sort((a, b) => a.order - b.order);
    } else if (direction === 'down' && index < bannerSettings.textElements.length - 1) {
      const elements = [...bannerSettings.textElements];
      [elements[index].order, elements[index + 1].order] = [elements[index + 1].order, elements[index].order];
      bannerSettings.textElements = elements.sort((a, b) => a.order - b.order);
    }
  }
  
  function getAvailableFonts(language) {
    return language === 'hebrew' ? hebrewFonts : fonts;
  }
  
  function syncFromMappedField(element) {
    if (element.mappedField === 'custom') return;
    
    // Map lot fields to content
    const fieldMap = {
      title: bannerSettings.title,
      titleHebrew: bannerSettings.titleHebrew,
      subtitle: bannerSettings.subtitle,
      subtitleHebrew: bannerSettings.subtitleHebrew,
      yearEnglish: bannerSettings.yearEnglish,
      yearHebrew: bannerSettings.yearHebrew,
      category: bannerSettings.category,
      categoryHebrew: bannerSettings.categoryHebrew,
    };
    
    if (fieldMap[element.mappedField] !== undefined) {
      element.content = fieldMap[element.mappedField] || '';
    }
  }
  
  // Create a sorted array without mutating the original
  let sortedTextElements = $derived(
    bannerSettings.textElements 
      ? [...bannerSettings.textElements].sort((a, b) => a.order - b.order)
      : []
  );
</script>

<CollapsibleSection
  title={ui("Text Elements")}
  bind:isCollapsed
  bgColor="bg-blue-50"
  borderColor="border-blue-200"
  hoverColor="hover:bg-blue-100"
>
  <div class="space-y-4">
    <div class="flex items-center justify-between mb-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={bannerSettings.useFlexibleTextElements}
          class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
        />
        <span class="text-sm font-medium text-gray-700">{ui("Use Flexible Text Elements")}</span>
      </label>
      {#if bannerSettings.useFlexibleTextElements}
        <button
          type="button"
          onclick={addTextElement}
          class="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 focus:ring-2 focus:ring-purple-500"
        >
          {ui("+ Add Element")}
        </button>
      {/if}
    </div>
    
    {#if bannerSettings.useFlexibleTextElements}
      <div class="space-y-3">
        {#each sortedTextElements as element, index (element.id)}
          <div class="p-3 border border-gray-300 rounded-lg bg-white">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  bind:checked={element.enabled}
                  class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <input
                  type="text"
                  bind:value={element.label}
                  placeholder={ui("Element label")}
                  class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div class="flex gap-1">
                <button
                  type="button"
                  onclick={() => moveElement(index, 'up')}
                  disabled={index === 0}
                  class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                  title={ui("Move up")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onclick={() => moveElement(index, 'down')}
                  disabled={index === bannerSettings.textElements.length - 1}
                  class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                  title={ui("Move down")}
                >
                  ↓
                </button>
                {#if bannerSettings.textElements.length > 1}
                  <button
                    type="button"
                    onclick={() => removeTextElement(index)}
                    class="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                    title={ui("Remove")}
                  >
                    ×
                  </button>
                {/if}
              </div>
            </div>
            
            {#if element.enabled}
              <div class="space-y-2 mt-2">
                <!-- Content Source -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    {ui("Content Source")}
                  </label>
                  <select
                    bind:value={element.mappedField}
                    onchange={() => syncFromMappedField(element)}
                    class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  >
                    {#each fieldMappings as mapping}
                      <option value={mapping.value}>{mapping.label}</option>
                    {/each}
                  </select>
                </div>
                
                <!-- Content -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    {ui("Content")}
                  </label>
                  <textarea
                    bind:value={element.content}
                    placeholder={element.mappedField === 'custom' ? ui("Enter text...") : ui("Auto-filled from mapped field")}
                    rows="2"
                    dir={element.language === 'hebrew' ? 'rtl' : 'ltr'}
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 resize-y"
                  ></textarea>
                </div>
                
                <!-- Language -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    {ui("Language")}
                  </label>
                  <select
                    bind:value={element.language}
                    class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="english">{ui("English")}</option>
                    <option value="hebrew">{ui("Hebrew")}</option>
                  </select>
                </div>
                
                <!-- Font Settings -->
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      {ui("Font Family")}
                    </label>
                    <select
                      bind:value={element.fontFamily}
                      class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    >
                      {#each getAvailableFonts(element.language) as font}
                        <option value={font.value}>{font.name}</option>
                      {/each}
                    </select>
                  </div>
                  
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      {ui("Font Weight")}
                    </label>
                    <select
                      bind:value={element.fontWeight}
                      class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="normal">{ui("Normal")}</option>
                      <option value="300">{ui("Light")}</option>
                      <option value="400">{ui("Regular")}</option>
                      <option value="500">{ui("Medium")}</option>
                      <option value="600">{ui("Semi Bold")}</option>
                      <option value="700">{ui("Bold")}</option>
                      <option value="bold">{ui("Bold (legacy)")}</option>
                    </select>
                  </div>
                </div>
                
                <!-- Size and Alignment -->
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      {ui("Font Size")}
                    </label>
                    <input
                      type="number"
                      bind:value={element.fontSize}
                      min="12"
                      max="200"
                      step="1"
                      class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      {ui("Alignment")}
                    </label>
                    <select
                      bind:value={element.align}
                      class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="left">{ui("Left")}</option>
                      <option value="center">{ui("Center")}</option>
                      <option value="right">{ui("Right")}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      {ui("Line Height")}
                    </label>
                    <input
                      type="number"
                      bind:value={element.lineHeight}
                      min="0.8"
                      max="3"
                      step="0.1"
                      class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                
                <!-- Color -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    {ui("Color")}
                  </label>
                  <div class="flex gap-2">
                    <input
                      type="color"
                      bind:value={element.color}
                      class="h-8 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      bind:value={element.color}
                      class="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                
                <!-- Margins -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    {ui("Margins (Top, Bottom, Left, Right)")}
                  </label>
                  <div class="grid grid-cols-4 gap-2">
                    <input
                      type="number"
                      bind:value={element.marginTop}
                      placeholder={ui("Top")}
                      class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      bind:value={element.marginBottom}
                      placeholder={ui("Bottom")}
                      class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      bind:value={element.marginLeft}
                      placeholder={ui("Left")}
                      class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      bind:value={element.marginRight}
                      placeholder={ui("Right")}
                      class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                
                <!-- Padding -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    {ui("Padding (Top, Bottom, Left, Right)")}
                  </label>
                  <div class="grid grid-cols-4 gap-2">
                    <input
                      type="number"
                      bind:value={element.paddingTop}
                      placeholder={ui("Top")}
                      class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      bind:value={element.paddingBottom}
                      placeholder={ui("Bottom")}
                      class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      bind:value={element.paddingLeft}
                      placeholder={ui("Left")}
                      class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      bind:value={element.paddingRight}
                      placeholder={ui("Right")}
                      class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-xs text-gray-500">{ui("Enable flexible text elements to use the new system. Legacy text fields will be used when disabled.")}</p>
    {/if}
  </div>
</CollapsibleSection>

