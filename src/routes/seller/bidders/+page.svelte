<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import BidderDirectory from '$lib/components/BidderDirectory.svelte';
  let { data } = $props();
</script>
<svelte:head><title>{ui("Bidders | Pumbi")}</title></svelte:head>
<main class="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
  <header><p class="pumbi-eyebrow">{data.bidderHouse.name}</p><h1 class="mt-2 font-[family-name:var(--pumbi-serif)] text-4xl font-semibold">{ui("Bidders")}</h1><p class="mt-3 text-sm text-[var(--pumbi-ink-soft)]">{ui("View your house’s bidder history, wins, and payments. Owners and house admins can manage bidding blocks.")}</p></header>
  <BidderDirectory directory={data.directory} house={data.bidderHouse} canViewProfiles={data.canViewBidderProfiles} />
</main>
