# Pumbi

## Node.js

Use Node.js 24 (`nvm use`). The `engines.node` setting in `package.json` pins
Vercel builds to 24.x and overrides an older project-level Node.js setting.
The Vercel adapter in `svelte.config.js` also targets `nodejs24.x`; `npm run build`
generates the deployable `.vercel/output` directory locally and on Vercel.

## Database

```sh
npm install
npm run db:migrate
```

Copy `.env.example` to `.env` and provide the required secrets. Never commit `.env`.

## Platform administrator

After creating a normal account, promote it from a trusted terminal:

```sh
npm run admin:promote -- admin@example.com
```

Sign in again, then open `/admin` to publish Pumbi rates and terms, configure the monthly PUBLIC auction series, and review independent-seller submissions.

## Live auction video (LiveKit Cloud)

Create a LiveKit Cloud project and set `LIVEKIT_URL` (`wss://your-project.livekit.cloud`),
`LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in the server environment and Vercel's
environment variables, then redeploy. Keep the API secret server-side. No database
migration or LiveKit webhook is required. LiveKit usage is billed to that project.

In the auction's **Control room**, claim the auctioneer seat, click **Preview camera
& microphone**, allow the browser permissions, then click **Go live**. The preview
is local until Go live. **Mute microphone** controls broadcast audio, and **Stop
broadcast** stops the camera/microphone and removes the publisher from the room.
Leaving the control room also releases the camera and microphone. Only the assigned
auctioneer with auction-management permission can publish or stop the broadcast.

The public auction page connects viewers automatically, including viewers who opened
the page before the broadcast began. Video autoplays muted; **Enable sound** opts in
to audio. Viewers are subscribe-only and never request camera/microphone access.
Connections retry after disconnection and close when an auction ends. Use HTTPS
(or localhost) for browser camera/microphone access. Existing video URL embeds remain
available as a fallback when the browser broadcast is offline.

For a live smoke test, use two browsers: broadcast from the control room in one,
open the auction page in the other, then verify automatic video, Enable sound,
microphone mute/unmute, stopping/restarting the broadcast, and leaving the page.

## Stripe Connect and payout releases

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, then configure Stripe to send
`account.updated` events to:

```text
https://your-pumbi-host.example/api/webhooks/stripe
```

Auction-house owners, administrators, and finance members use `/seller/banking`
to create or resume Stripe Connect Express onboarding. Bank account, tax, and
identity details are collected by Stripe and never pass through Pumbi. Stripe
status is refreshed when that page loads and by signed webhooks.

An approved house with Stripe payouts enabled can request a release by amount,
currency, source reference, and reason. Platform administrators review requests
at `/admin/payouts`. Approval atomically claims the request and creates a Stripe
transfer with a stable idempotency key; rejection requires a reason.

Transfers debit the platform Stripe balance. The source reference is internal
metadata/transfer grouping, not a Stripe `source_transaction`. Production
settlement must ensure the platform has sufficient available funds, or extend
the payment flow to retain and supply the originating charge or balance
transaction dependency where applicable.

## Room activity and seller analytics

Live auction pages, lot detail pages, and the seller control room show room and bid
activity. Room presence deduplicates visible page sessions by signed-in user or
anonymous browser ID across an auction and all its lots. Sessions heartbeat every
15 seconds and expire from the room count after 45 seconds without an update.
Hiding or leaving a page ends presence; returning resumes the existing view without
counting a new page view or including hidden time in dwell metrics.

**Bidding now** counts distinct people currently in the room who submitted an auction
bid within the last five minutes; it is zero after an auction ends. **Auction bidders**
and **Total bids** cover the auction's full history. Statistics refresh every five
seconds on visible pages. These are approximate presence counts, not LiveKit video
connections, and work without video streaming configured.

The current-lot step chart compares the running bid price in USD with cumulative
unique bidders. The whole-auction chart compares cumulative bid count with unique
bidders. Each axis is labeled separately. A keyboard-accessible slider exposes exact
values at the retained events. Complete cumulative totals are calculated before long
histories are sampled to at most 120 events; early bids are included in totals.

The seller home dashboard reports all-time sold/unsold lots, auction counts,
sell-through (sold divided by sold plus unsold), hammer sales and average sold-lot
value. Owners, administrators, and finance members can see received/outstanding
invoice totals, average paid-invoice amounts, and payment-method breakdowns.
Collections include only `PAID` invoices; outstanding balances include `UNPAID`,
`PENDING_CHECKOUT`, and `AWAITING_EXTERNAL`. Refunded and canceled invoices are
excluded. Different currencies remain separate; hammer sales use the auction's
existing USD bid convention. Invoice collections are not seller bank payouts.
Use **Refresh analytics** after recording payments. No schema migration is required.

`npm test` covers visibility lifecycle, chart calculations, financial definitions,
tenant permissions, and data redaction. To additionally run the isolated PostgreSQL
activity test, provide `TEST_DATABASE_URL` and run
`node --test tests/auctionActivity.integration.test.js`. Its fixtures use temporary
tables and a rolled-back transaction; application data is not read or changed.

## Monthly auction automation

Configure a production scheduler to send a POST request at least hourly:

```sh
curl -X POST https://your-pumbi-host.example/api/cron/auctions \
  -H "Authorization: Bearer $CRON_SECRET"
```

The endpoint creates due PUBLIC auction occurrences, snapshots the active policy, advances monthly schedules, and transitions auction statuses. Calls are idempotent, and normal browser sessions cannot invoke it.

Set each series' “next generation run” before its auction start. The start offset controls how long sellers and administrators have to submit and review lots; the dashboard defaults to 14 days.
