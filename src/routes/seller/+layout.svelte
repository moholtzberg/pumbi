<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import SellerNav from '$lib/components/SellerNav.svelte';

  let { data, children } = $props();

  let session = $state(data?.session);

  let limited = $derived(
    Boolean(
      data?.auctionHouse &&
        data.auctionHouse.onboardingStatus !== 'APPROVED' &&
        data?.session?.user?.role !== 'PLATFORM_ADMIN'
    )
  );

  $effect(() => {
    if (!session?.user) {
      goto('/auth/login?redirect=' + encodeURIComponent($page.url.pathname));
    }
  });

  onMount(() => {
    const checkInterval = setInterval(async () => {
      try {
        const res = await fetch('/auth/session', { credentials: 'include' });
        if (!res.ok) {
          clearInterval(checkInterval);
          goto('/auth/login?redirect=' + encodeURIComponent($page.url.pathname));
          return;
        }

        const sessionData = await res.json();
        if (!sessionData?.user) {
          clearInterval(checkInterval);
          goto('/auth/login?redirect=' + encodeURIComponent($page.url.pathname));
        } else {
          session = sessionData;
        }
      } catch (error) {
        console.error('Error checking session:', error);
        clearInterval(checkInterval);
        goto('/auth/login?redirect=' + encodeURIComponent($page.url.pathname));
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  });
</script>

<div class="pumbi-page">
  <SellerNav auctionHouse={data?.auctionHouse} {limited} />
  {@render children?.()}
</div>
