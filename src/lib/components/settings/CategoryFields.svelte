<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let { settings = $bindable({ categoryMetaFields: {} }) } = $props();
  let newCategoryName = $state('');
  function addMetaField(category) {
    if (!settings.categoryMetaFields[category]) {
      settings.categoryMetaFields[category] = [];
    }
    settings.categoryMetaFields[category].push({
      key: `field_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      options: [],
      placeholder: '',
      helpText: '',
    });
  }

  function removeMetaField(category, index) {
    settings.categoryMetaFields[category].splice(index, 1);
    if (settings.categoryMetaFields[category].length === 0) {
      delete settings.categoryMetaFields[category];
    }
  }

  function addCategory() {
    if (
      newCategoryName.trim() &&
      !settings.categoryMetaFields[newCategoryName.trim()]
    ) {
      settings.categoryMetaFields[newCategoryName.trim()] = [];
      newCategoryName = '';
    }
  }

  function removeCategory(category) {
    delete settings.categoryMetaFields[category];
  }
</script>

<div class="space-y-6">
  <!-- Add New Category -->
  <div class="bg-gray-50 p-4 rounded-sm mb-6">
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={newCategoryName}
        placeholder={ui("Enter category name (e.g., Books, Art, Jewelry)")}
        class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCategory();
          }
        }}
      />
      <button
        type="button"
        onclick={addCategory}
        class="px-4 py-2 bg-[#18372f] text-white text-sm rounded-sm hover:bg-[#152c26] transition-colors"
      >
        {ui("Add Category")}
      </button>
    </div>
  </div>

  <!-- Configured Categories -->
  {#each Object.entries(settings.categoryMetaFields || {}) as [category, fields]}
    <div class="border border-gray-200 rounded-sm p-4 mb-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">{category}</h3>
        <button
          type="button"
          onclick={() => removeCategory(category)}
          class="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          {ui("Remove Category")}
        </button>
      </div>

      {#each fields as field, index}
        <div class="bg-white border border-gray-200 rounded-sm p-4 mb-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">
                {ui("Field Label")}
              </label>
              <input
                type="text"
                bind:value={field.label}
                placeholder={ui("e.g., Author, Year Printed")}
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">
                {ui("Field Type")}
              </label>
              <select
                bind:value={field.type}
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
              >
                <option value="text">{ui("Text")}</option>
                <option value="number">{ui("Number")}</option>
                <option value="date">{ui("Date")}</option>
                <option value="boolean">{ui("Yes/No")}</option>
                <option value="select">{ui("Dropdown")}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">
                {ui("Placeholder")}
              </label>
              <input
                type="text"
                bind:value={field.placeholder}
                placeholder={ui("Optional placeholder text")}
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
              />
            </div>
            <div class="flex items-center">
              <label class="settings-toggle">
                <input
                  type="checkbox"
                  bind:checked={field.required}
                  class="me-2 h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
                />
                <span class="text-xs font-medium text-gray-700">
                  {ui("Required field")}
                </span>
              </label>
            </div>
          </div>

          {#if field.type === 'select'}
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-700 mb-1">
                {ui("Options (one per line)")}
              </label>
              <textarea
                value={field.options?.join('\n') || ''}
                oninput={(e) => {
                  field.options = e.target.value
                    .split('\n')
                    .filter((o) => o.trim());
                }}
                placeholder={ui("Option 1 Option 2 Option 3")}
                rows="3"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
              ></textarea>
            </div>
          {/if}

          <div class="mb-3">
            <label class="block text-xs font-medium text-gray-700 mb-1">
              {ui("Help Text (optional)")}
            </label>
            <input
              type="text"
              bind:value={field.helpText}
              placeholder={ui("Additional information for users")}
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#18372f] focus:border-[#18372f]"
            />
          </div>

          <button
            type="button"
            onclick={() => removeMetaField(category, index)}
            class="text-red-600 hover:text-red-800 text-xs font-medium"
          >
            {ui("Remove Field")}
          </button>
        </div>
      {/each}

      <button
        type="button"
        onclick={() => addMetaField(category)}
        class="w-full mt-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-sm hover:bg-gray-200 transition-colors"
      >
        {ui("+ Add Field")}
      </button>
    </div>
  {/each}

  {#if Object.keys(settings.categoryMetaFields || {}).length === 0}
    <div class="text-center py-12 text-gray-500">
      <p>{ui("No category meta fields configured yet.")}</p>
      <p class="text-sm mt-2">{ui("Add a category above to get started.")}</p>
    </div>
  {/if}
</div>
