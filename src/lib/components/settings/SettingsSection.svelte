<script>
  let { title, description = '', children } = $props();
</script>

<section class="settings-section pumbi-panel">
  <header>
    <h2>{title}</h2>
    {#if description}<p>{description}</p>{/if}
  </header>
  <div class="settings-section-body">{@render children()}</div>
</section>
