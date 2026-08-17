-- AlterTable
ALTER TABLE "lot_images" ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "lot_images_is_hidden_idx" ON "lot_images"("is_hidden");

