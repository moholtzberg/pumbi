# Pumbi

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

## Monthly auction automation

Configure a production scheduler to send a POST request at least hourly:

```sh
curl -X POST https://your-pumbi-host.example/api/cron/auctions \
  -H "Authorization: Bearer $CRON_SECRET"
```

The endpoint creates due PUBLIC auction occurrences, snapshots the active policy, advances monthly schedules, and transitions auction statuses. Calls are idempotent, and normal browser sessions cannot invoke it.

Set each series' “next generation run” before its auction start. The start offset controls how long sellers and administrators have to submit and review lots; the dashboard defaults to 14 days.
