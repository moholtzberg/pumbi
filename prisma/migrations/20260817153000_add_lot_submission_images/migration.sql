CREATE TABLE "lot_submission_images" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cloud_key" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_submission_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lot_submission_images_submission_id_idx" ON "lot_submission_images"("submission_id");

ALTER TABLE "lot_submission_images" ADD CONSTRAINT "lot_submission_images_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "lot_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
