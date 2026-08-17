CREATE TABLE "lot_watches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_watches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lot_watches_user_id_lot_id_key" ON "lot_watches"("user_id", "lot_id");
CREATE INDEX "lot_watches_user_id_idx" ON "lot_watches"("user_id");
CREATE INDEX "lot_watches_lot_id_idx" ON "lot_watches"("lot_id");

ALTER TABLE "lot_watches" ADD CONSTRAINT "lot_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_watches" ADD CONSTRAINT "lot_watches_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
