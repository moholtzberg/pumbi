<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import {
    STANDARD_BID_INCREMENTS,
    lotBidIncrement,
  } from '$lib/utils/bidIncrements.js';
  import { formatMoney } from '$lib/utils/region.js';
  let {
    rows = $bindable([]),
    inherited = [],
    scope = 'house',
    currency = 'usd',
    locked = false,
  } = $props();
  let preview = $state(1000);
  let enabled = $derived(Boolean(rows?.length));
  let effective = $derived(enabled ? rows : inherited);
  const money = (value) => formatMoney(value, currency);
  function enable(event) {
    rows = event.currentTarget.checked
      ? structuredClone(
          inherited.length
            ? $state.snapshot(inherited)
            : STANDARD_BID_INCREMENTS,
        )
      : [];
  }
  function add() {
    const last = [...rows].sort((a, b) => a.from - b.from).at(-1);
    rows = [
      ...rows,
      {
        from: (Number(last?.from) || 0) + 100,
        increment: (Number(last?.increment) || 5) * 2,
      },
    ];
  }
</script>

<div class="space-y-5">
  <label class="settings-toggle">
    <input
      type="checkbox"
      checked={enabled}
      onchange={enable}
      disabled={locked}
    /><span>
      <strong>
        {scope === 'auction'
          ? ui("Override the house increment schedule for this auction")
          : ui("Use a house increment schedule")}
      </strong><small>
        {scope === 'auction'
          ? ui("Leave off to follow the house schedule. A published public-auction policy takes precedence.")
          : ui("When off, lots use their individual fixed increment unless the auction has a schedule.")}
      </small>
    </span>
  </label>
  {#if enabled}
    <div class="overflow-x-auto">
      <table class="settings-table">
        <thead>
          <tr>
            <th>{ui("Bid amount from (inclusive)")}</th><th>{ui("Increment")}</th><th>
              <span class="sr-only">{ui("Actions")}</span>
            </th>
          </tr>
        </thead><tbody>
          {#each rows as row, index}<tr>
              <td>
                <input
                  aria-label={ui("Price threshold {value0}", { value0: index + 1 })}
                  type="number"
                  min="0"
                  step="0.01"
                  bind:value={row.from}
                  disabled={locked}
                  required
                />
              </td><td>
                <input
                  aria-label={ui("Increment {value0}", { value0: index + 1 })}
                  type="number"
                  min="0.01"
                  step="0.01"
                  bind:value={row.increment}
                  disabled={locked}
                  required
                />
              </td><td>
                <button
                  type="button"
                  class="settings-remove"
                  disabled={locked || rows.length === 1}
                  onclick={() => (rows = rows.filter((_, i) => i !== index))}
                >
                  {ui("Remove")}
                </button>
              </td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        class="pumbi-btn-secondary"
        disabled={locked}
        onclick={add}
      >
        {ui("Add tier")}
      </button><button
        type="button"
        class="pumbi-btn-secondary"
        disabled={locked}
        onclick={() =>
          (rows = STANDARD_BID_INCREMENTS.map((row) => ({ ...row })))}
      >
        {ui("Use standard tiers")}
      </button>
    </div>
    <p class="settings-help">
      {ui("Start at 0. Each threshold must be unique and each increment positive. Rules are sorted when saved. The increment changes when the current bid reaches a threshold.")}
    </p>
  {:else if inherited.length}
    <div class="settings-note">
      <p class="font-semibold">{ui("Inherited house schedule")}</p>
      <p class="mt-2 text-sm">
        {inherited
          .map((row) => `${money(row.from)} → +${money(row.increment)}`)
          .join(' · ')}
      </p>
    </div>
  {/if}
  {#if effective.length}<div class="settings-preview">
      <label>
        <span>{ui("Preview at bid amount")}</span><input
          type="number"
          min="0"
          step="0.01"
          bind:value={preview}
        />
      </label>
      <p>
        {ui("Increment")} <strong>
          {money(
            lotBidIncrement({
              currentBid: preview,
              bidIncrement: 1,
              bidIncrementSchedule: effective,
            }),
          )}
        </strong><small>
          {ui("Automatic counterbids use the tier at the competing maximum. The winning bid never exceeds the bidder’s maximum.")}
        </small>
      </p>
    </div>{/if}
</div>
