-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "fair_warning_at" TIMESTAMP(3),
ADD COLUMN     "fair_warning_key" TEXT;

-- AlterTable
ALTER TABLE "bids" ADD COLUMN     "is_automatic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sequence" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "proxy_bids" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "max_amount" DECIMAL(18,2) NOT NULL,
    "source" "BidSource" NOT NULL DEFAULT 'ONLINE',
    "recorded_by_id" TEXT,
    "priority_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proxy_bids_user_id_idx" ON "proxy_bids"("user_id");

-- CreateIndex
CREATE INDEX "proxy_bids_recorded_by_id_idx" ON "proxy_bids"("recorded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "proxy_bids_lot_id_user_id_key" ON "proxy_bids"("lot_id", "user_id");

-- AddForeignKey
ALTER TABLE "proxy_bids" ADD CONSTRAINT "proxy_bids_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_bids" ADD CONSTRAINT "proxy_bids_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_bids" ADD CONSTRAINT "proxy_bids_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

