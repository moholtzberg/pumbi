<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let { values = $bindable({}), fields = [] } = $props();
</script>

<div class="settings-grid">
  {#each fields as field}
    <label
      class:settings-wide={field.wide}
      class:settings-toggle={field.type === 'checkbox'}
    >
      {#if field.type === 'checkbox'}
        <input
          type="checkbox"
          bind:checked={values[field.key]}
          disabled={field.disabled}
        />
        <span>
          <strong>{ui(field.label)}</strong>{#if field.help}<small>
              {ui(field.help)}
            </small>{/if}
        </span>
      {:else}
        <span>{ui(field.label)}</span>
        {#if field.type === 'textarea'}<textarea
            rows={field.rows || 4}
            bind:value={values[field.key]}
            placeholder={ui(field.placeholder || '')}
            disabled={field.disabled}></textarea>
        {:else if field.type === 'number'}<input
            type="number"
            bind:value={values[field.key]}
            min={field.min ?? 0}
            max={field.max}
            step={field.step ?? 'any'}
            placeholder={ui(field.placeholder || '')}
            disabled={field.disabled}
          />
        {:else if field.type === 'select'}<select
            bind:value={values[field.key]}
            disabled={field.disabled}
          >
            {#each field.options as option}<option value={option.value}>
                {ui(option.label)}
              </option>{/each}
          </select>
        {:else}<input
            type="text"
            bind:value={values[field.key]}
            placeholder={ui(field.placeholder || '')}
            disabled={field.disabled}
          />{/if}
        {#if field.help}<small>{ui(field.help)}</small>{/if}
      {/if}
    </label>
  {/each}
</div>
