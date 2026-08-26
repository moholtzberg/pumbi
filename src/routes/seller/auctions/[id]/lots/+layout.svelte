<script>
  import LotsSubnav from '$lib/components/LotsSubnav.svelte';
  import { page } from '$app/stores';

  let { children } = $props();
  let auctionId = $derived($page.params.id);
</script>

<LotsSubnav {auctionId} />
{@render children?.()}
