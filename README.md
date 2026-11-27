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
For pooled PostgreSQL hosts such as Neon, set `DIRECT_URL` to the unpooled connection
for Prisma schema operations. The application continues to use pooled `DATABASE_URL`;
`prisma.config.js` prefers `DIRECT_URL` for migrations so session migration locks
are not retained by a transaction pooler.

## Transactional email (SMTP2GO)

Email verification codes, password-reset links, buyer invoices, and auction-house
team invitations use the shared SMTP2GO HTTPS API service. Set `SMTP2GO_API_KEY`,
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
auction terms, and authorization of automatic bidding up to the caller’s maximum. Available
auction terms are shown in the form. Both auction-management and bidder-management
permissions are required.

New callers are registered/approved for this auction. An existing account matching
the email is reused without overwriting its contact details; rejected registrations
must be reviewed separately. New accounts have no password and do not receive
email, phone, identity, card, or online-bidding verification automatically. Online
bidding enforces verification when the auction requires bidder registration.

Phone bids obey minimum increments, the on-block lot and timer, and inherited
bid-extension rules. The auctioneer, seller, and lot owner cannot be selected as the caller. The current
high bidder can increase their maximum without raising the public price. Auction/lot row locks serialize phone bids,
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

## Seller CRM and auction marketing

Open **Seller → Marketing** (`/seller/marketing`). Owners, admins, and auction
managers with auction and bidder management permissions can manage their house's
contacts. CRM records are separate from platform users; imports never create login
accounts or approve bidders.

- Add/edit/delete contacts with name, email, phone, tags, and notes. Search and
  pagination keep large lists manageable. Contacts can be paused without deleting
  them. Email addresses are normalized and unique within a house.
- Upload or paste CSV (up to 500 contacts / 2 MB per import), using the downloadable
  `/marketing-contacts-template.csv`. Columns are `name,email,phone,tags,notes`;
  `first_name,last_name,email_address,phone_number` aliases are also accepted.
  Quoted commas, multiline notes, BOM, and CRLF are supported. The whole import
  is validated before writing; duplicate emails update existing details.
- Choose an upcoming/live auction and save its email settings. Customize the
  invitation subject/message, optionally invite contacts immediately when adding
  or importing, or invite selected/all subscribed contacts later. Invitations are
  deduplicated per auction and address. Contacts must have agreed to receive your
  house's auction emails; opted-out addresses cannot be resubscribed by reimport.
- Auction-start reminders default to 30 minutes before the scheduled start
  (configurable 5–1,440 minutes). They target invited subscribed contacts plus
  approved registered bidders with verified email addresses, deduplicated by email.
  A changed start time creates a new reminder event; stale reminders are skipped.
- Watched-lot reminders use actual ready-lot order. The first ready lot can notify
  watchers five minutes before the auction starts; once the auctioneer starts,
  current and next-up lots notify watchers with verified email addresses. Opening
  a lot queues reminders immediately; delivery follows the minute scheduler.
  Watches removed before sending, hidden/closed lots, cancelled auctions, changed
  queue positions, and house opt-outs are checked again before sending. Each lot
  sends at most one accepted reminder per address in an auction, including relists.
- Send custom auction updates to that auction's invited subscribed contacts. The
  email includes your message and an auction link. Phones are stored for reference;
  CRM campaigns currently send email, not SMS.
- Email activity shows queued, processing, accepted, failed, unconfirmed, and
  cancelled messages. Known rejections can be retried. Unconfirmed sends (timeouts,
  ambiguous responses, interrupted workers) are never automatically retried;
  inspect SMTP2GO activity before sending a replacement. Provider acceptance is not
  an inbox-delivery guarantee. Live reminders are processed before invitations.

Every marketing email has a signed house-specific unsubscribe link and a `List-Unsubscribe`
header. Viewing the preferences page does not change settings; the
recipient confirms with a POST. Opt-out suppressions survive contact deletion and
reimport, apply to watched-lot reminders too, and do not affect account verification
or password-reset emails.

Apply `prisma/migrations/20261124160000_add_seller_marketing` with
`npx prisma migrate deploy` on each deployment database, then regenerate Prisma.
The admin Data manager automatically includes the five new CRM models.

`vercel.json` registers `/api/cron/marketing` every minute on Vercel Pro. Configure
`CRON_SECRET`, `AUTH_SECRET`, `SMTP2GO_API_KEY`, and optionally
`SMTP2GO_FROM_EMAIL` in Vercel, then deploy. `APP_URL` should be the canonical public
site origin; if absent, campaign creation saves the current site's origin. No
campaign is created or email sent merely by installing the feature: the seller
must configure an auction and invite contacts or enable its reminders.

The worker accepts authenticated GET or POST requests using
`Authorization: Bearer $CRON_SECRET`, processes up to 25 messages per run with
bounded concurrency, and atomically claims messages against concurrent workers.
Use **Process queued emails now** for a house-scoped manual run. No browser tab
needs to remain open. Larger mailouts drain over multiple scheduler runs. On hosts
without Vercel Cron, call the same endpoint every minute from an external scheduler.

Run `npm test` for CRM unit/route checks. For an explicit real-PostgreSQL check,
run `RUN_MARKETING_DATABASE_TESTS=1 node --test tests/marketing.integration.test.js`
under Node 24. The test inserts fixtures inside a rolled-back transaction and uses
mocked delivery; it sends no email and retains no test contacts or campaigns.


## Maximum bids and fair warning

Bidders can set a **private maximum bid** on the live auction page or lot detail
page, or use **Bid $X only** to cap their offer at the next minimum. Phone callers
use the same maximum-bid engine. Bidding remains limited to the current live,
ready lot while its timer is open; this does not enable absentee/pre-auction bids.

At a current price of $25 with a $5 increment, a new $100 maximum advances to $30
when nobody has a higher maximum. If the incumbent has a $150 maximum, a new $100
maximum is immediately outbid at $105. A higher new $150 maximum against an
existing $100 maximum wins at $105. Equal maximums favor the existing leader;
prices never exceed the winning maximum, even when that means a smaller final
increment. All calculations use integer cents.

A leading bidder may increase their own maximum without bidding against themselves:
no public bid, price increase, timer extension, or warning reset occurs. Maximums
cannot be lowered. New public bids retain bidder/source/recording-auctioneer
attribution, and automatic defense bids are labeled **Auto** in history. A database
sequence breaks timestamp ties between a challenger and the automatic response.
Existing public prices remain binding; old bids are not retrospectively converted
into hidden maximums. The winning public price drives the invoice.

`ProxyBid` stores private ceilings separately from public `Bid` rows. Public lot,
live-room, history, broadcast, and analytics responses never include private
ceilings. `GET /api/bids?view=maximum&lotId=...` requires authentication and returns
only the current user's ceiling with private/no-store caching. The platform admin
Data manager treats `maxAmount` as write-only. Automatic defense rechecks bidder
approval and public-policy acceptance; online maximums also require current buyer
verification when the auction requires registration. Revocation stops further automatic defense without erasing an already
accepted public bid.

The auctioneer’s close button first reads **Fair warning**. Clicking it publishes
a warning on the bidder pages and video overlay and leaves at least ten seconds on
the lot clock. The button then becomes **Hammer down** (sold/unsold). A new competitive
bid, opening the lot, or extending its timer clears the warning. Hammer requests
must match the current warning's random reference under the same auction/lot locks
used by online and phone bids. Stale hammer requests are rejected and the operator
must give fair warning again. With auto-advance enabled, timer expiry gives fair
warning first; it hammers only after that warning’s clock expires. Manually
hammering remains controlled by the auctioneer. Ending the auction cannot bypass
closing the tracked lot.

Apply `20261124180000_add_proxy_bidding_and_fair_warning` using
`npx prisma migrate deploy`, regenerate Prisma, and redeploy. Unit/route checks are
in `tests/phoneBids.test.js`. An opt-in PostgreSQL test runs with
`RUN_PROXY_DATABASE_TESTS=1 node --test tests/proxyBidding.integration.test.js` under
Node 24. It creates only rolled-back fixtures, checks effective prices and warning
locks through the real routes, and mocks invoice creation. It places no real bids
and sends no notifications.


## Bidding without advance registration

**Auction settings → Bidding Settings → Require registration to bid** controls
access for every lot in that auction. When off (the default), any signed-in user who is not blocked by the house
can bid while the lot is open, without advance registration, manual approval,
buyer verification, or a separate terms-acceptance step. This applies to both
PRIVATE and PUBLIC auctions. A missing setting follows the default of off.
Registration records are not fabricated as a side effect of bidding.

When on, PRIVATE auctions require verified buyers and approved registrations;
PUBLIC auctions require verified buyers and acceptance of the current auction
policy. Automatic maximum-bid defenses use the same rule as incoming bids, so an
open-auction bidder is not silently excluded for lacking verification/registration.
Switching registration on rechecks those requirements for future automatic bids.
Signed-out users, bidding on your own lot, and bids outside the current live lot's
open timer remain blocked. Bid amounts, auction terms, and buyer premiums continue
to apply. No schema migration is needed for this access-rule change.


## House bidder profiles and blocks

**Seller → Bidders** lists people who registered, placed bids, won lots, or have
invoices with the selected house. Open-auction bidders appear without needing a
registration record. Search by name/email/phone, filter blocked bidders, and page
through the directory. The auction's **Bidders & approvals** screen has the same
participant directory, and bidder names in registrations and control-room bid
history link to profiles for owners/admins.

House owners and admins can open `/seller/bidders/:id?houseId=...` to see contact
information, verification status, auction participation, won lots, and invoice
history. Histories and financial totals are scoped to that house. The profile
never exposes another house's activity, private maximum bids, passwords, Stripe
IDs, or identity/card details. Auction managers can view the directory under their
existing bidder-management permission; full profiles and blocking require an
active OWNER/ADMIN membership (or platform-admin access).

Balances are grouped by currency and calculated with decimal arithmetic. PAID
invoices contribute to received amounts. UNPAID, AWAITING_EXTERNAL and
PENDING_CHECKOUT invoices contribute to outstanding amounts. REFUNDED and
CANCELLED are shown separately. Won lots without invoices show “Invoice pending”
and do not invent an outstanding balance. Registrations, bids, wins, and invoices
are visible in paginated histories, including open auctions with no registration.

From the profile, enter an internal reason and click **Block from all house
auctions**. The block overrides registration/approval settings across all current
and future auctions at that house. It stops incoming online bids, staff-recorded
phone bids, maximum increases, and automatic maximum defenses. Registering or
completing verification does not bypass it. Only the blocked/not-blocked state is
sent to the bidder; the reason and operator audit data stay in owner/admin views.

Blocking preserves existing public bids, wins and invoices. A currently leading
public bid remains binding; the blocked ceiling cannot defend against new bids.
**Unblock bidder** restores access under each auction's rules, and previously
submitted maximums can respond again on live lots. Unblock audit fields and the
last reason are retained. A block at one house does not block other houses.

The bid engine holds a shared, transaction-scoped PostgreSQL advisory guard while
checking blocks and accepting bids; block/unblock takes the exclusive guard.
Concurrent bids can share the guard, and a block cannot race behind a committed
bid check. Guards release with the transaction and work with pooled connections.

Apply `20261124200000_add_house_bidder_blocks` with `npx prisma migrate deploy`
before deploying the new code. The admin Data manager includes `BidderBlock`.
Tests cover permissions, exact currency balances, tenant isolation, owner block
flows, and bid/phone/automatic enforcement. Run the opt-in, rolled-back PostgreSQL
checks using `RUN_BIDDER_DATABASE_TESTS=1 node --test tests/sellerBidders.integration.test.js`
under Node 24. They send no messages, move no money, and retain no test data.


## Sending sold-lot invoices

**Send invoice** and **Record payment** are separate actions on both the Sold list
and an individual invoice's shipping/tools page. Send invoice emails the recorded
buyer through SMTP2GO with the invoice number, auction/lot, itemized amounts,
current payment status, and a link to `/dashboard/invoices/:id`. The buyer must
sign in to their own account to view/pay it. The recipient comes from the invoice;
request payloads cannot substitute another address.

When buyer-paid shipping is not selected yet, the email marks shipping as pending
and the current total as excluding that shipping choice. Paid, refunded, or
cancelled invoices send a copy with their current status and no payment request.
Sending never records a payment, starts card checkout, or purchases shipping.
Mail failures appear beside the button; successful sends show the buyer's address.
Record payment retains its existing cash/check/Stripe workflow. No migration is
required. Invoice-email tests use a mock provider and send no real messages.

## Saved addresses and invoice contact details

Buyers can add, edit, delete, and choose a default delivery address under
**Buyer dashboard → Profile → Saved shipping addresses**. Invoice shipping uses
that default and offers a selector for other saved addresses or a custom address.
Existing invoice destinations take precedence over later profile changes. Changing
the destination requires a fresh shipping quote before payment. Legacy free-text
profile addresses still prefill checkout; ambiguous city/postcode fields need review.

Auction house contact information appears on buyer and seller invoice pages and
invoice emails. The recorded headquarters address is preferred, with the house
settings address as a fallback. Seller and house onboarding prefill missing contact
fields from the user's account. New seller Stripe accounts also receive contact
and address defaults; existing Stripe account details are preserved.

Apply `prisma/migrations/20261125010000_add_user_addresses` using
`npx prisma migrate deploy`, then regenerate Prisma before deploying to another
database. It is already applied to this workspace's configured database. The
migration adds an address table and a unique partial index for one default per user.
Address writes lock the account row and enforce ownership on the server.

Run `npm test` for unit and route checks. To include the rolled-back PostgreSQL
address/checkout/onboarding integration test, set `RUN_ADDRESS_DATABASE_TESTS=1`
and load `DATABASE_URL` (or `TEST_DATABASE_URL`) into the test environment. No real
emails, shipping labels, or Stripe transactions are triggered by these tests.

## Hebrew and Israeli buyers / sellers

The header language selector switches English / עברית, persists a language cookie,
and saves the preference for signed-in users. Hebrew renders the document right to
left. Navigation, registration/login, buyer profile and saved addresses, invoice
checkout, seller details, house onboarding, verification, and banking have Hebrew
labels. Buyer invoice and verification-code emails use the saved language. Catalog
content, seller-written terms, and other untranslated screens retain their original
text; this is not automatic translation of user content or legal documents.

Account country is independent of language. Registration and Profile accept Israel
(`IL`), Israeli local numbers normalize to `+972`, and structured Israeli shipping
addresses accept a seven-digit postcode without requiring a US state. Shippo quotes
use recorded house origins rather than invented US details. A buyer-paid shipping
rate must use the invoice currency; the application does not silently convert it.

Choose `ILS` under **House settings → Localization → Default Currency** for new
shekel auctions. New auctions snapshot their currency; existing auctions retain
USD unless they already have an explicit currency. Changing house settings does
not relabel existing bids or invoices. Catalog, live bidding, overlays, invoices,
and Stripe checkout use the auction/invoice currency. ILS amounts use agorot
(100 agorot = 1 ILS). Dashboard won-value totals are separated by currency.

Stripe-hosted Checkout uses `locale: auto`; Hebrew is not in its supported locale
list. The Identity/Connect providers determine supported languages and accepted
identity, tax, and bank documents. Pumbi does not require Israeli users to supply
US SSNs or EINs and does not store their raw identity/tax/bank numbers.

### Israeli payout setup remains external

No live Israeli payout route is activated by this change. Seller verification,
house onboarding, and Banking show setup options instead of creating a US account
for an Israeli recipient. Existing connected accounts can continue resolving their
provider requirements, and actual provider payout-enabled status is still required
before a release can be requested.

- Ask Stripe to approve the platform's Israeli Connect account agreement and funds
  flow: <https://docs.stripe.com/connect/connect-cross-border-payouts>.
- Evaluate Stripe Global Payouts for eligible platforms:
  <https://docs.stripe.com/global-payouts>. This needs separate recipient onboarding,
  funding, payout APIs, and status handling; existing Connect transfers do not use it.
- Alternatively, select an Israeli provider that supports the marketplace business
  model, seller verification, and payouts, then integrate its API/webhooks.

Only after Stripe explicitly approves the existing Connect route, configure
`STRIPE_ISRAEL_CONNECT_AGREEMENT=full` or `recipient` to match that approval. Older
approved recipient arrangements must not be assumed available to a new platform.
Leaving it unset keeps new Israeli Connect onboarding unavailable. Test-mode country
coverage does not establish live-account approval. No real payouts were made to
validate this change. Do not create an account under a false country to bypass it.

Apply `prisma/migrations/20261126010000_add_account_region` with
`npx prisma migrate deploy` and regenerate Prisma before deploying to another
database. This migration is already applied to the workspace's configured database.
It adds account country/language, seller payout country, and fixed auction currency.

`tests/region.test.js` and `tests/israelPayments.test.js` cover Hebrew preferences,
Israeli phone/address parsing, country locks and activation, ILS invoice/Stripe
amounts, and shipping currency checks. The PostgreSQL address integration test also
covers Hebrew addresses and real shekel invoice creation; it rolls back all fixtures.

## Bid increment schedules and settings ownership

Bidding uses the same price-tier resolver for online bids, proxy defenses, phone
bids, the lot page, and the control room. An increment threshold is inclusive:
with `0 → 5`, `50 → 10`, and `1000 → 100`, the next bid after 45 is 50,
after 50 is 60, and after 1000 is 1100. Proxy defenses apply the tier at the
competing maximum and remain capped by the winning maximum. Opening bids start
at the lot's opening price.

For private auctions the order is **auction schedule → current house schedule →
lot fixed increment**. House schedules can be enabled/disabled under
**House settings → Bid increments**; each auction can opt into its own schedule.
Public auctions with a published policy schedule retain that policy's rules.
Tables require a tier starting at 0, unique nonnegative thresholds, and positive
increments, with at most two decimals. Saves sort the table automatically.

House settings own currency and fee defaults for new auctions, the house tier
schedule, default timers, final-round relisting, external payment method names,
category fields, terms for new sales, and house catalog-writing guidance. Company
identity, addresses/branding, banking, team access, and marketing each link to their
existing dedicated screen. Auction settings own sale details, registration,
auto-advance, buyer-paid shipping, optional increment/timer overrides, external
stream URLs, catalog appearance, and auction catalog guidance. Currency and
snapshotted fees are displayed as read-only sale facts. Lot timers override the
auction timer, then house timer, then platform default.

Inactive and overlapping legacy switches are omitted from the forms; existing
stored values are preserved. Payment method fee/VAT fields are not presented as
working surcharges. State managed by the control room, including `onBlockLotId`
and the unsold relist round, survives settings saves and cannot be forged by a
settings request. Omitted settings and nested gallery fields are merged under the
auction/house row lock rather than replaced by a partial request.

Fee snapshots use fractions (0.15); invoices use percentage points (15). The rate
resolver now converts those units for new invoices and the read-only settings
summary. Previously issued invoice amounts are not rewritten.

No migration is required. Tests cover tier boundaries, proxy limits/ties, phone
and online enforcement, validation, settings permissions/inheritance, state
preservation, and real rolled-back PostgreSQL bidding/settings transactions.

## Platform admin inventory management

**Admin → Auction houses / Auctions / Lots** now provide paginated management
lists with search, status filters, sorting, and direct **Edit** / **Remove** row
actions. Auctions include both public and private sales. House rows link to that
house's auctions and lots; auction rows link to their lots. The house partner
profile also provides editing, removal, and child-inventory shortcuts. Lot prices
use their auction's currency.

Editing opens a common-fields form directly in the list. Optional blank fields
are editable without a technical null toggle. **Show all fields** retains the
full schema editor and JSON mode. Record pickers can search related houses,
auctions, and users. New lots opened from an auction-filtered list prefill the
auction reference.

Removal opens the existing dependency/cascade preview directly. The exact record
ID and current revision are still required before the server deletes anything.
Role checks, self-admin protection, write-only secrets, and stale-edit rejection
remain in the shared admin data service. No live records are removed by deploying
this change.

Recurring series, public-sale creation, policies, and submission review are under
**Admin → Auction operations** (`/admin/auction-operations`). All-auction inventory
is at `/admin/auctions`. The advanced data manager remains available for every
collection. No migration is required.

`tests/adminInventory.test.js` covers list authorization, scope filters, status /
type validation, pagination, row actions, currency display, and common-field
selection. Set `RUN_ADMIN_DATABASE_TESTS=1` alongside the existing database-test
flags to run the rolled-back PostgreSQL inventory, edit, revision, and removal
test. Browser interaction checks use disposable preview fixtures rather than
real partner records.

## Auction house public addresses

Approved, active houses publish a storefront at `/<slug>` with their public
contact details and current/past auctions. `/auction-houses/<slug>` redirects to
that address. Storefront data is scoped to the house and excludes private
onboarding settings and unready lot counts.

Signup generates the slug as the name is typed until it is manually edited.
Signup and platform admin saves normalize slugs to lowercase, check uniqueness
without case sensitivity, and reject reserved platform routes. Older mixed-case
slugs resolve through a case-insensitive fallback; mixed-case URLs redirect to
lowercase. Seller settings and platform admin house views link to published
pages. No migration is required.

`tests/houseSlugs.test.js` covers generation, validation, routes, visibility,
scope, pagination, and safe public data. Set `RUN_STOREFRONT_DATABASE_TESTS=1`
to include the rolled-back PostgreSQL storefront and admin slug-edit test.

## Hebrew interface

Hebrew uses the installed `David` font with `Times New Roman`, `Times`, and serif
fallbacks for body copy, headings, and form controls. Interface typography does
not depend on downloading a Hebrew web font. The banner artwork editor retains
its optional font choices.

Page copy uses the shared translation catalog across the marketplace, auctions,
lots, buyer account/invoices, seller workspace, CRM, settings, and platform admin.
Admin schema labels and enum choices are translated for display while submitted
field keys and values remain unchanged. Dates, times, and money follow the UI
locale; currency follows the auction/invoice. Logical alignment and spacing
support RTL. The admin sidebar also includes a language selector.

Catalog titles, descriptions, account names, and house-entered terms remain as
authored. Provider-hosted screens follow that provider's language support.
Unknown messages retain their original text. Add shared interface translations
to `src/lib/locales/he-ui.js` and schema labels to `he-admin.js`.

`tests/i18nUi.test.js` checks Hebrew and English rendering, interpolation,
catalog-content preservation, schema-label coverage, unchanged option values,
and static text that bypasses localization. Browser checks cover Hebrew font
selection, RTL overflow, marketplace filters, lot activity, and sign-in labels.

## Seller submission drafts and availability

`/dashboard/sell` offers starter categories, categories from ready public catalog
lots, and a custom category field. Drafts may be saved without a title, completed
seller contact details, images, or a destination auction. The first save creates
the account's draft profile automatically. A draft can also be saved after its
selected auction's submission deadline passes.

Submitting still requires complete seller contact details, a title, current
seller terms acceptance, and an eligible public auction/series. Complete contact
defaults are saved when submitting. Terms acceptance is visible without opening
the terms panel; missing auction windows have an explicit explanation. The sole
eligible destination is preselected for new drafts. Failed submission attempts
retain the saved draft ID and refresh the terms/window before retrying.

Vercel Cron now schedules `/api/cron/auctions` every minute alongside marketing.
GET and POST share bearer authentication using `CRON_SECRET`; GET supports
Vercel's scheduler. Deployment activates this schedule. No live automation was
invoked while testing. Existing deadlines and approval requirements are retained.

`tests/lotSubmissions.test.js` covers draft/submit validation, ownership, catalog
choices and cron authentication. `RUN_SUBMISSION_DATABASE_TESTS=1` enables the
rolled-back PostgreSQL test. Browser checks use an in-memory fixture to save a
blank draft, fill seller details, choose a public auction and submit for review.

## Lot photos and creation

The seller workspace provides **Attach photos** independently of AI analysis.
If optional AI analysis fails, the uploaded photo remains attached for manual
catalog entry. Upload responses keep the persistent storage URL/key separate
from `previewUrl`, which is readable for private S3/Spaces images.

All seller/catalog image upload controls share a per-file transport. Photos up
to 12 MB are accepted by the client; large photos are resized to fit a 3.5 MB
upload budget and files are sent sequentially. The server checks authentication,
existing-lot permissions, image signatures, and per-file limits. Failed optional
background removal retains the original photo and reports it accurately.

Lot creation validates images before writing and creates image records together
with the lot in one database operation. Existing-lot image additions use a
transaction. The Add lot form waits for uploads and suggests a number above the
highest existing lot number, rather than using the count of lots.

`tests/imageUpload.test.js` covers file validation, previews, permissions, AI and
background-processing fallback, request splitting, and large-photo preparation.
`RUN_LOT_CREATION_DATABASE_TESTS=1` runs the rolled-back PostgreSQL creation,
duplicate-number, image-record and permission checks. A synthetic storage smoke
test uploaded/read one tiny PNG and deleted that test object successfully.
