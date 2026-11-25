import { error } from '@sveltejs/kit';

// Shared locks allow bids to run concurrently. An owner takes the exclusive lock
// while changing a block, so no accepted bid can race past a committed block.
// Transaction-scoped locks are safe with pooled Postgres connections.
export async function lockHouseBidderAccess(tx, houseId, { exclusive = false } = {}) {
  const scope = `pumbi:bidder-access:${houseId}`;
  if (exclusive) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
  else await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${scope}, 0))::text`;
}
export async function bidderIsBlocked(client, auctionHouseId, userId) {
  const block = await client.bidderBlock.findUnique({ where: { auctionHouseId_userId: { auctionHouseId, userId } }, select: { active: true } });
  return Boolean(block?.active);
}
export async function requireUnblockedBidder(client, houseId, userId) {
  if (await bidderIsBlocked(client, houseId, userId)) throw error(403, 'This auction house has blocked your bidding access. Contact the auction house for assistance.');
}
