<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { translate } from '$lib/i18n.js';
  import { page } from '$app/stores';
  const t = (text, values) => translate($page.data.locale || 'en', text, values);
let { house } = $props();</script>
{#if house}
  <section class="mt-5 border border-[var(--pumbi-line)] bg-white p-5 text-sm" aria-label={ui("Auction house contact information")}>
    <p class="text-xs font-bold uppercase tracking-wider text-[var(--pumbi-muted)]">{t("Auction house")}</p>
    <p class="mt-2 font-semibold">{house.name}</p>
    {#if house.address}<p class="mt-2 whitespace-pre-line">{house.address}</p>{/if}
    {#if house.email}<p class="mt-2">{t("Email:")} {house.email}</p>{/if}
    {#if house.phone}<p class="mt-1">{t("Phone:")} {house.phone}</p>{/if}
    {#if house.website}<p class="mt-1 break-words">{house.website}</p>{/if}
  </section>
{/if}
