CREATE TYPE "ContactVerificationChannel" AS ENUM ('EMAIL', 'PHONE');

CREATE TABLE "contact_verification_codes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "channel" "ContactVerificationChannel" NOT NULL,
  "destination_hash" CHAR(64) NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_verification_codes_user_id_channel_created_at_idx"
  ON "contact_verification_codes"("user_id", "channel", "created_at");
CREATE INDEX "contact_verification_codes_expires_at_idx"
  ON "contact_verification_codes"("expires_at");

ALTER TABLE "contact_verification_codes"
  ADD CONSTRAINT "contact_verification_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
