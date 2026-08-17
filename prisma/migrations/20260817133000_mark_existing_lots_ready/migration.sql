-- Existing lots predate the publishing workflow and must remain visible/biddable.
-- New lots continue to default to is_ready = false until their owner publishes them.
UPDATE "lots" SET "is_ready" = true;
