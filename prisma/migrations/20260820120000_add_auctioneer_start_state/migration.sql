ALTER TABLE "auctions"
ADD COLUMN "auctioneer_id" TEXT,
ADD COLUMN "auctioneer_started_at" TIMESTAMP(3);

CREATE INDEX "auctions_auctioneer_id_idx" ON "auctions"("auctioneer_id");

ALTER TABLE "auctions"
ADD CONSTRAINT "auctions_auctioneer_id_fkey"
FOREIGN KEY ("auctioneer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
