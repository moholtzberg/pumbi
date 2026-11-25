-- CreateTable
CREATE TABLE "bidder_blocks" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "blocked_by_id" TEXT,
    "unblocked_by_id" TEXT,
    "blocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidder_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bidder_blocks_user_id_idx" ON "bidder_blocks"("user_id");

-- CreateIndex
CREATE INDEX "bidder_blocks_blocked_by_id_idx" ON "bidder_blocks"("blocked_by_id");

-- CreateIndex
CREATE INDEX "bidder_blocks_unblocked_by_id_idx" ON "bidder_blocks"("unblocked_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "bidder_blocks_auction_house_id_user_id_key" ON "bidder_blocks"("auction_house_id", "user_id");

-- AddForeignKey
ALTER TABLE "bidder_blocks" ADD CONSTRAINT "bidder_blocks_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_blocks" ADD CONSTRAINT "bidder_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_blocks" ADD CONSTRAINT "bidder_blocks_blocked_by_id_fkey" FOREIGN KEY ("blocked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_blocks" ADD CONSTRAINT "bidder_blocks_unblocked_by_id_fkey" FOREIGN KEY ("unblocked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

