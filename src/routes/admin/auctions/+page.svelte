<script>
  import AdminInventory from '$lib/components/admin/AdminInventory.svelte';
  let { data } = $props();
</script>
<AdminInventory {data} kind="auction" />
