ALTER TABLE "lots"
ADD COLUMN "initial_timer_seconds" INTEGER,
ADD COLUMN "bid_extension_seconds" INTEGER;

ALTER TABLE "lots"
ADD CONSTRAINT "lots_initial_timer_seconds_positive" CHECK ("initial_timer_seconds" IS NULL OR "initial_timer_seconds" > 0),
ADD CONSTRAINT "lots_bid_extension_seconds_positive" CHECK ("bid_extension_seconds" IS NULL OR "bid_extension_seconds" > 0);
