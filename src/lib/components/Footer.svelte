<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);
</script>
<footer id="partner" class="site-footer print:hidden">
  <div class="footer-inner">
    <div class="footer-brand"><a href="/"><span>P</span><strong>Pumbi</strong></a><p>{ui("Remarkable objects, fairly found.")}</p></div>
    <div><h3>{ui("Discover")}</h3><a href="/#auctions">{ui("Live auctions")}</a><a href="/#auctions">{ui("Upcoming")}</a><a href="/#category-heading">{ui("Categories")}</a><a href="/#auctions">{ui("Auction results")}</a></div>
    <div><h3>{ui("Sell with Pumbi")}</h3><a href="/auction-houses/signup">{ui("For auction houses")}</a><a href="/auction-houses/signup">{ui("Request a demo")}</a><a href="/seller">{ui("Seller portal")}</a></div>
    <div><h3>{ui("About")}</h3><a href="/#partner">{ui("How it works")}</a><a href="mailto:hello@pumbi.com">{ui("Contact")}</a><a href="/auth/register">{ui("Create an account")}</a></div>
  </div>
  <div class="footer-bottom"><span>© {new Date().getFullYear()} {ui("Pumbi. All rights reserved.")}</span><div><a href="/">{ui("Privacy")}</a><a href="/">{ui("Terms")}</a><a href="/">{ui("Accessibility")}</a></div></div>
</footer>

<style>
  .site-footer { background: #152c26; color: #d7ded9; padding: 72px max(24px,calc((100vw - 1240px)/2)) 25px; }
  .footer-inner { display: grid; grid-template-columns: 2fr repeat(3,1fr); gap: 60px; padding-bottom: 65px; }
  .footer-brand a { display: flex; align-items: center; gap: 12px; color: #fff; }
  .footer-brand a span { display: grid; place-items: center; width: 38px; height: 38px; background: #a95739; font: italic 25px Georgia,serif; }
  .footer-brand strong { font: 600 29px 'Cormorant Garamond',Georgia,serif; }
  .footer-brand p { color: #91a29a; font: italic 17px Georgia,serif; margin-top: 22px; }
  h3 { color: #d6b477; margin: 0 0 18px; font-size: 10px; text-transform: uppercase; letter-spacing: .13em; }
  .footer-inner > div:not(.footer-brand) a { display: block; color: #bec9c4; font-size: 12px; margin-bottom: 12px; }
  .footer-inner a:hover { color: #fff; }
  .footer-bottom { border-top: 1px solid rgba(255,255,255,.13); padding-top: 22px; display: flex; justify-content: space-between; color: #84958d; font-size: 10px; }
  .footer-bottom div { display: flex; gap: 22px; }
  @media (max-width: 760px) { .footer-inner { grid-template-columns: 1fr 1fr; gap: 40px; }.footer-brand { grid-column: 1/-1; }.footer-bottom { display:block; }.footer-bottom div { margin-top:15px; } }
</style>
