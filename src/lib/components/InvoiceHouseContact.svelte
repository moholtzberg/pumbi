<script>let { house } = $props();</script>
{#if house}
  <section class="mt-5 border border-[var(--pumbi-line)] bg-white p-5 text-sm" aria-label="Auction house contact information">
    <p class="text-xs font-bold uppercase tracking-wider text-[var(--pumbi-muted)]">Auction house</p>
    <p class="mt-2 font-semibold">{house.name}</p>
    {#if house.address}<p class="mt-2 whitespace-pre-line">{house.address}</p>{/if}
    {#if house.email}<p class="mt-2">Email: {house.email}</p>{/if}
    {#if house.phone}<p class="mt-1">Phone: {house.phone}</p>{/if}
    {#if house.website}<p class="mt-1 break-words">{house.website}</p>{/if}
  </section>
{/if}
