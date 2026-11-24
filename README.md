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

## Transactional email (SMTP2GO)

Email verification codes, password-reset links, and auction-house team invitations
use the shared SMTP2GO HTTPS API service. Set `SMTP2GO_API_KEY`,
`SMTP2GO_FROM_EMAIL=Pumbi <hello@ginzeyamerica.com>`, and `APP_URL` (the public
site origin) in the server environment and in Vercel, then redeploy. The sender
defaults to the address above, which must be authorized under SMTP2GO's Verified
Senders. Existing SMS verification continues through SMTP2GO.

Messages include plain text and HTML. Provider failures (including HTTP 200
responses containing errors) are rejected, requests have a 15-second timeout,
and sends are not automatically retried to avoid duplicates. API acceptance is
not a guarantee of inbox delivery; use SMTP2GO's activity reports to investigate
bounces. Password-reset requests keep the same response for unknown accounts
and delivery errors, and reset tokens are never logged. Links expire after one
hour. Invitations retain the manual-copy link when no SMTP2GO key is configured;
when configured, a failed send reports an error and removes the pending invitation
so it can be retried. Resend credentials are no longer used.

See the [SMTP2GO sending API documentation](https://developers.smtp2go.com/docs/send-an-email).

## Platform administrator

After creating a normal account, promote it from a trusted terminal:

```sh
npm run admin:promote -- admin@example.com
```

Sign in again, then open `/admin` to publish Pumbi rates and terms, configure the monthly PUBLIC auction series, and review independent-seller submissions.

The **Data manager** at `/admin/data` provides create/read/update/delete controls
for every Prisma model: users, houses, auctions, lots, bids, registrations,
submissions, policies, invoices, shipments, payouts, analytics, and associated
records. Collections have search, enum/boolean filters, sortable columns, and
pagination. Record editors offer typed forms, JSON editing, relationship lookup,
and links to dependent records. Existing Users/Lots/Houses/Auctions screens link
to the manager as well.

Every page and API operation checks the current database role for `PLATFORM_ADMIN`.
Passwords and verification/reset/session secrets are write-only; new user passwords
are hashed and invalidate old password-reset tokens. Record IDs stay fixed after
creation. Updates and deletes check the original `updatedAt` revision while holding
a row lock; stale editors must reload. An admin cannot delete or demote their own
account, and the last platform admin cannot be removed.

Deletion requires typing the record ID and follows the schema's cascade/restrict/
set-null rules. The editor lists directly related records and their delete behavior;
nested cascades also apply. Foreign-key restrictions return an actionable error.
This is a direct data editor: changing stored invoice, payout, shipment, or auction
state does not call external payment/shipping services or run auction workflows.
Use the existing operational screens for those actions. No schema migration is
needed; collection metadata is derived from the schema at build time.

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

When an auction goes live, its public page automatically switches to a split view:
current lot and bidding on the left, live video on the right, stacking on mobile.
Broadcast graphics show Pumbi, the actual auction-house name, auction title,
current lot and bid, countdown, and next lot. The auctioneer preview shows the same
graphics. The video panel's Fullscreen control includes the graphics on supported
browsers. These are in-page overlays; the outgoing camera media is unchanged.
Existing embedded video URLs remain supported in the video panel. Room analytics,
the lot queue, and bid history remain below the live view.

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

## Phone bids in the control room

The assigned auctioneer can click **+ Phone bid** on the current lot. Choose an
approved registered bidder, or add a new caller using a real name, email for
invoices, and phone number. Confirm the caller's identity, acceptance of the
auction terms, and authorization of the bid, then record the amount. Available
auction terms are shown in the form. Both auction-management and bidder-management
permissions are required.

New callers are registered/approved for this auction. An existing account matching
the email is reused without overwriting its contact details; rejected registrations
must be reviewed separately. New accounts have no password and do not receive
email, phone, identity, card, or online-bidding verification automatically. Online
bidding continues to enforce the normal verification requirements.

Phone bids obey minimum increments, the on-block lot and timer, and inherited
bid-extension rules. The auctioneer, seller, lot owner, and current highest bidder
cannot be selected as the caller. Auction/lot row locks serialize phone bids,
online bids, and hammering. Winning phone bids use the caller's buyer ID for the
ordinary invoice and fulfillment flow.

Bid history labels these records **Phone**. `Bid.source` defaults old and normal
online bids to `ONLINE`; `PHONE` bids retain the recording auctioneer's user ID.
Apply the additive migration before deploying against another database:
`npx prisma migrate deploy`. The migration is already applied to the database
configured in this workspace. No email or SMS is sent when adding a caller.

## Relist unsold lots in the same auction

From the seller dashboard, open **Unsold lot settings** (or **House settings →
Advanced**) and enable **Relist unsold lots at the end of an auction**. The default
is off. House owners and administrators can save this setting.

When the sale finishes, ready unsold lots without bids, a winning bidder, or an
invoice are reactivated for one extra round in that same auction. Their IDs,
lot numbers, order, descriptions, images, and opening prices are preserved.
Current bids and lot timers reset. Sold, withdrawn, and unready lots are excluded.
The auction ends after the extra round; ordinary settings saves cannot reset it.

In an auctioneer-run sale, auto-advance opens the first relisted lot using the
inherited time-on-block setting. With auto-advance off, the lots wait in the control
room for the auctioneer to open them. The control room announces the extra round.
For a scheduled sale that has not started its floor, the original auction duration
is added to its closing window once (minimum one minute). Manual ending, last-lot
completion, and scheduled completion all use the same transaction-locked logic.
No schema migration is required. Enabling the setting does not reopen already-ended
auctions.

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
