CREATE TYPE "BidSource" AS ENUM ('ONLINE', 'PHONE');
ALTER TABLE "bids"
  ADD COLUMN "source" "BidSource" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "recorded_by_id" TEXT;
CREATE INDEX "bids_recorded_by_id_idx" ON "bids"("recorded_by_id");
ALTER TABLE "bids" ADD CONSTRAINT "bids_recorded_by_id_fkey"
  FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
