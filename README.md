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

## Monthly auction automation

Configure a production scheduler to send a POST request at least hourly:

```sh
curl -X POST https://your-pumbi-host.example/api/cron/auctions \
  -H "Authorization: Bearer $CRON_SECRET"
```

The endpoint creates due PUBLIC auction occurrences, snapshots the active policy, advances monthly schedules, and transitions auction statuses. Calls are idempotent, and normal browser sessions cannot invoke it.

Set each series' “next generation run” before its auction start. The start offset controls how long sellers and administrators have to submit and review lots; the dashboard defaults to 14 days.
