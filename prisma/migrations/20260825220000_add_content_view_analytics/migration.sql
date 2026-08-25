-- AlterTable
ALTER TABLE "auctions" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "auctions" ADD COLUMN "unique_visitor_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "auctions" ADD COLUMN "total_dwell_ms" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "lots" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lots" ADD COLUMN "unique_visitor_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lots" ADD COLUMN "total_dwell_ms" BIGINT NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "ContentViewEntity" AS ENUM ('AUCTION', 'LOT');

-- CreateTable
CREATE TABLE "content_views" (
    "id" TEXT NOT NULL,
    "entity_type" "ContentViewEntity" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "visitor_key" TEXT NOT NULL,
    "user_id" TEXT,
    "session_key" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "referrer" TEXT,
    "user_agent" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_views_session_key_key" ON "content_views"("session_key");
CREATE INDEX "content_views_entity_type_entity_id_started_at_idx" ON "content_views"("entity_type", "entity_id", "started_at");
CREATE INDEX "content_views_entity_type_entity_id_visitor_key_idx" ON "content_views"("entity_type", "entity_id", "visitor_key");
CREATE INDEX "content_views_visitor_key_started_at_idx" ON "content_views"("visitor_key", "started_at");
CREATE INDEX "content_views_user_id_idx" ON "content_views"("user_id");
