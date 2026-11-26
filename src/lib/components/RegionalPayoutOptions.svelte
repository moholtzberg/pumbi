<script>
  import { page } from '$app/stores';
  import { translate } from '$lib/i18n.js';
  const t = text => translate($page.data.locale || 'en', text);
</script>
<section class="mt-4 space-y-3 border border-amber-200 bg-amber-50 p-4 text-sm" aria-label={t('Israeli payout setup options')}>
  <h3 class="font-bold">{t('Israeli payout setup options')}</h3>
  <p>{t('No Israeli payout provider is active yet. Identity verification and card payments are separate from receiving seller payouts.')}</p>
  <ul class="list-disc space-y-3 ps-5">
    <li><a class="font-semibold underline" href="https://stripe.com/contact" target="_blank" rel="noreferrer">{t('Request Stripe approval for Israeli Connect payouts')}</a><p>{t('Ask Stripe which Israeli account agreement and funds flow they approve for this platform. Activation is required before onboarding Israeli sellers here.')}</p></li>
    <li><a class="font-semibold underline" href="https://docs.stripe.com/global-payouts" target="_blank" rel="noreferrer">Stripe Global Payouts</a><p>{t('An alternative for eligible platforms sending money to Israel. Requires account activation and a separate recipient and payout integration; the current Connect transfer flow does not use it.')}</p></li>
    <li><strong>{t('Integrate an Israeli payment and payout provider')}</strong><p>{t('Choose a provider that supports marketplace seller verification, Israeli bank payouts, and your business model. Provider credentials and an integration are needed before activation.')}</p></li>
  </ul>
</section>
