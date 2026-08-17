CREATE TYPE "VerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REQUIRES_INPUT');

ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMP(3),
  ADD COLUMN "phone_verified_at" TIMESTAMP(3),
  ADD COLUMN "identity_verification_status" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "identity_verified_at" TIMESTAMP(3),
  ADD COLUMN "stripe_identity_session_id" TEXT,
  ADD COLUMN "stripe_customer_id" TEXT,
  ADD COLUMN "card_verification_status" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "card_verified_at" TIMESTAMP(3),
  ADD COLUMN "default_payment_method_id" TEXT,
  ADD COLUMN "payment_method_brand" TEXT,
  ADD COLUMN "payment_method_last4" TEXT;

ALTER TABLE "seller_profiles"
  ADD COLUMN "stripe_connect_account_id" TEXT,
  ADD COLUMN "stripe_connect_status" "StripeConnectStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
  ADD COLUMN "stripe_connect_details_submitted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripe_connect_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripe_connect_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripe_connect_onboarding_done" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "users_stripe_identity_session_id_key" ON "users"("stripe_identity_session_id");
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");
CREATE INDEX "users_identity_verification_status_idx" ON "users"("identity_verification_status");
CREATE INDEX "users_card_verification_status_idx" ON "users"("card_verification_status");
CREATE UNIQUE INDEX "seller_profiles_stripe_connect_account_id_key" ON "seller_profiles"("stripe_connect_account_id");
