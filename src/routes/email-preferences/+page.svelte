<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
let { data, form } = $props();</script>
<svelte:head><title>{ui("Email preferences | Pumbi")}</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main class="mx-auto max-w-xl px-6 py-20">
  <p class="pumbi-eyebrow">{ui("Email preferences")}</p>
  {#if form?.unsubscribed}
    <h1 class="mt-4 text-3xl font-semibold">{ui("You’re unsubscribed")}</h1>
    <p class="mt-5">{ui("You will no longer receive auction invitations, marketing updates, or watched-lot reminders from")} {data.houseName}.</p>
  {:else}
    <h1 class="mt-4 text-3xl font-semibold">{ui("Emails from")} {data.houseName}</h1>
    <p class="my-6">{ui("Stop auction invitations, marketing updates, and watched-lot reminders from this auction house. Account verification and password-reset emails will continue.")}</p>
    <form method="POST"><button class="bg-[#18372f] px-6 py-3 font-bold text-white">{ui("Unsubscribe from this house")}</button></form>
  {/if}
</main>
