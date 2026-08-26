<script>
  import AuctionSubnav from '$lib/components/AuctionSubnav.svelte';

  let { data, children } = $props();
</script>

<div class="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
  {#if data.auctionNav}
    <AuctionSubnav
      auctionId={data.auctionNav.id}
      title={data.auctionNav.title}
      status={data.auctionNav.status}
      type={data.auctionNav.type}
    />
  {/if}
  {@render children?.()}
</div>
