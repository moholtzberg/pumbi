import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// Optional PostgreSQL verification. All fixtures live in temporary tables and
// the transaction is rolled back; no application data is read or modified.
test('PostgreSQL activity deduplicates presence, expires stale sessions, and samples complete bid histories', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 15000 });
  let server;
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE lots (id text, auction_id text) ON COMMIT DROP');
    await client.query('CREATE TEMP TABLE bids (id text, lot_id text, user_id text, amount double precision, timestamp timestamp, sequence serial) ON COMMIT DROP');
    await client.query('CREATE TEMP TABLE content_views (visitor_key text, user_id text, entity_type text, entity_id text, last_seen_at timestamp, ended_at timestamp) ON COMMIT DROP');
    await client.query("INSERT INTO lots VALUES ('lot-a','auction'),('lot-b','auction'),('other-lot','other-auction')");
    const now = new Date('2026-11-23T12:00:00Z');
    const ago = seconds => new Date(now.getTime() - seconds * 1000);
    const views = [
      ['u:1','u1','AUCTION','auction',10,null], ['u:1','u1','LOT','lot-a',5,null],
      ['anonymous',null,'AUCTION','auction',30,null], ['u:2','u2','AUCTION','auction',46,null],
      ['u:3','u3','AUCTION','auction',10,ago(5)], ['u:4','u4','LOT','lot-b',45,null],
      ['other','u5','AUCTION','other-auction',1,null]
    ];
    for (const [key,user,type,id,seconds,ended] of views) {
      await client.query('INSERT INTO content_views VALUES ($1,$2,$3,$4,$5,$6)', [key,user,type,id,ago(seconds),ended]);
    }
    await client.query("INSERT INTO bids (id,lot_id,user_id,amount,timestamp) SELECT 'bid-' || i, 'lot-a', 'u' || (i % 5 + 1), i, $1::timestamp - interval '10 minutes' + i * interval '1 second' FROM generate_series(1,250) i", [now]);
    for (const [id,lot,user,amount,seconds] of [
      ['recent-1','lot-a','u1',300,60], ['recent-2','lot-b','u4',301,30],
      ['recent-3','lot-a','u2',302,20], ['recent-4','lot-a','u3',303,10],
      ['other','other-lot','outside',999,1]
    ]) await client.query('INSERT INTO bids (id,lot_id,user_id,amount,timestamp) VALUES ($1,$2,$3,$4,$5)', [id,lot,user,amount,ago(seconds)]);
    globalThis.__activitySqlTest = { $queryRaw: async (strings, ...values) => {
      const text = strings.map((part, i) => part + (i < values.length ? `$${i + 1}` : '')).join('');
      return (await client.query(text, values)).rows;
    } };
    server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true }, plugins: [{
      name: 'isolated-sql-fixture',
      resolveId(id) { if (id === '$lib/prisma.js') return '\0fixture-prisma'; },
      load(id) { if (id === '\0fixture-prisma') return 'export default globalThis.__activitySqlTest;'; }
    }] });
    const modulePath = fileURLToPath(new URL('../src/lib/server/auctionActivity.js', import.meta.url));
    const { getAuctionActivity } = await server.ssrLoadModule(modulePath);
    const result = await getAuctionActivity({ auctionId: 'auction', now });
    assert.equal(result.inRoom, 3);
    assert.equal(result.activeBidders, 2);
    assert.equal(result.totalBids, 254);
    assert.equal(result.totalBidders, 5);
    assert.equal(result.history.length, 120);
    assert.equal(result.history.at(-1).bids, 254);
    assert.equal(result.history.at(-1).bidders, 5);
    assert.equal(result.history.at(-1).price, 303);
    assert.ok(new Date(result.history[0].firstAt) < new Date(result.history[0].time));
    const lot = await getAuctionActivity({ auctionId: 'auction', lotId: 'lot-b', now });
    assert.equal(lot.history.length, 1);
    assert.equal(lot.history[0].bids, 1);
    assert.equal(lot.history[0].bidders, 1);
    assert.equal(lot.inRoom, 3);
  } finally {
    await server?.close();
    delete globalThis.__activitySqlTest;
    await client.query('ROLLBACK');
    await client.end();
  }
});
