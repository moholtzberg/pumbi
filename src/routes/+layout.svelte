<script>
	import '../app.css';
	import { page } from '$app/stores';
	let { children } = $props();
  	import Navigation from '$lib/components/Navigation.svelte';
</script>

{#if !$page.url.pathname.startsWith('/admin')}
	<Navigation />
{/if}

{@render children()}
