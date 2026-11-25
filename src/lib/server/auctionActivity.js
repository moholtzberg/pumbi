import prisma from '$lib/prisma.js';

export const ROOM_WINDOW_MS = 45_000;
export const BIDDING_WINDOW_MS = 5 * 60_000;

export async function getAuctionActivity({ auctionId, lotId = null, now = new Date() }) {
  const roomSince = new Date(now.getTime() - ROOM_WINDOW_MS);
  const biddingSince = new Date(now.getTime() - BIDDING_WINDOW_MS);
  const [counts, history] = await Promise.all([
    prisma.$queryRaw`
      WITH room AS (
        SELECT DISTINCT visitor_key, user_id FROM content_views
        WHERE ended_at IS NULL AND last_seen_at >= ${roomSince}
          AND ((entity_type = 'AUCTION' AND entity_id = ${auctionId})
            OR (entity_type = 'LOT' AND entity_id IN (SELECT id FROM lots WHERE auction_id = ${auctionId})))
      ), auction_bids AS (
        SELECT b.user_id, b.timestamp FROM bids b JOIN lots l ON l.id = b.lot_id
        WHERE l.auction_id = ${auctionId}
      )
      SELECT (SELECT COUNT(DISTINCT visitor_key) FROM room)::int AS "inRoom",
        (SELECT COUNT(DISTINCT b.user_id) FROM auction_bids b JOIN room r ON r.user_id = b.user_id
          WHERE b.timestamp >= ${biddingSince})::int AS "activeBidders",
        (SELECT COUNT(*) FROM auction_bids)::int AS "totalBids",
        (SELECT COUNT(DISTINCT user_id) FROM auction_bids)::int AS "totalBidders"
    `,
    // Compute complete cumulative totals before sampling; keep the last event in
    // each bucket. The response stays bounded without losing early bid totals.
    prisma.$queryRaw`
      WITH ranked AS (
        SELECT b.id, b.sequence, b.timestamp, b.amount,
          ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY b.timestamp, b.sequence) AS bidder_bid,
          ROW_NUMBER() OVER (ORDER BY b.timestamp, b.sequence) AS bid_number,
          MIN(b.timestamp) OVER () AS first_at,
          NTILE(120) OVER (ORDER BY b.timestamp, b.sequence) AS bucket
        FROM bids b JOIN lots l ON l.id = b.lot_id
        WHERE l.auction_id = ${auctionId} AND (${lotId}::text IS NULL OR b.lot_id = ${lotId})
      ), cumulative AS (
        SELECT *, SUM(CASE WHEN bidder_bid = 1 THEN 1 ELSE 0 END) OVER (ORDER BY timestamp, sequence) AS bidders,
          MAX(amount) OVER (ORDER BY timestamp, sequence) AS price FROM ranked
      )
      SELECT DISTINCT ON (bucket) timestamp, first_at AS "firstAt", price,
        bid_number::int AS bids, bidders::int AS bidders
      FROM cumulative ORDER BY bucket, timestamp DESC, sequence DESC
    `
  ]);
  return {
    ...counts[0],
    updatedAt: now.toISOString(),
    roomWindowSeconds: ROOM_WINDOW_MS / 1000,
    biddingWindowSeconds: BIDDING_WINDOW_MS / 1000,
    history: history.map(point => ({
      time: new Date(point.timestamp).toISOString(),
      firstAt: new Date(point.firstAt).toISOString(),
      price: Number(point.price), bids: Number(point.bids), bidders: Number(point.bidders)
    }))
  };
}
