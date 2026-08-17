-- CreateEnum
CREATE TYPE "AuctionHouseBusinessType" AS ENUM ('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLC', 'CORPORATION', 'NONPROFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "AuctionHouseOnboardingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StripeConnectStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'RESTRICTED', 'ENABLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuctionHouseLocationType" AS ENUM ('HEADQUARTERS', 'OFFICE', 'WAREHOUSE', 'SHOWROOM', 'OTHER');

-- CreateEnum
CREATE TYPE "AuctionHouseDocumentType" AS ENUM ('BUSINESS_LICENSE', 'TAX_DOCUMENT', 'BANK_VERIFICATION', 'INSURANCE', 'INCORPORATION', 'IDENTITY', 'OTHER');

-- CreateEnum
CREATE TYPE "AuctionHouseDocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuctionHouseAssetType" AS ENUM ('LOGO', 'BANNER', 'BRAND_GUIDE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuctionHouseAssetVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AuctionHouseMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'AUCTION_MANAGER', 'CATALOG_MANAGER', 'FINANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "AuctionHouseMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AuctionHouseInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PayoutReleaseStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "platform_policies"
    ADD COLUMN "auction_house_terms" TEXT;

-- AlterTable
ALTER TABLE "auction_houses"
    ADD COLUMN "legal_name" TEXT,
    ADD COLUMN "business_type" "AuctionHouseBusinessType",
    ADD COLUMN "registration_number" TEXT,
    ADD COLUMN "website" TEXT,
    ADD COLUMN "contact_first_name" TEXT,
    ADD COLUMN "contact_last_name" TEXT,
    ADD COLUMN "contact_email" TEXT,
    ADD COLUMN "contact_phone" TEXT,
    ADD COLUMN "country" TEXT,
    ADD COLUMN "onboarding_status" "AuctionHouseOnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "onboarding_step" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "onboarding_submitted_at" TIMESTAMP(3),
    ADD COLUMN "onboarding_reviewed_at" TIMESTAMP(3),
    ADD COLUMN "onboarding_approved_at" TIMESTAMP(3),
    ADD COLUMN "onboarding_rejected_at" TIMESTAMP(3),
    ADD COLUMN "onboarding_reviewed_by_id" TEXT,
    ADD COLUMN "onboarding_rejection_reason" TEXT,
    ADD COLUMN "stripe_connect_account_id" TEXT,
    ADD COLUMN "stripe_connect_status" "StripeConnectStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    ADD COLUMN "stripe_connect_details_submitted" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "stripe_connect_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "stripe_connect_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "stripe_connect_onboarding_done" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "tax_id_type" TEXT,
    ADD COLUMN "tax_id_last4" TEXT,
    ADD COLUMN "terms_version" INTEGER,
    ADD COLUMN "terms_snapshot" TEXT,
    ADD COLUMN "terms_accepted_at" TIMESTAMP(3),
    ADD COLUMN "terms_accepted_ip" TEXT,
    ADD COLUMN "terms_accepted_user_agent" TEXT;

-- Existing active houses predate onboarding and must remain operational.
UPDATE "auction_houses"
SET "onboarding_status" = 'APPROVED'
WHERE "is_active" = true;

-- CreateTable
CREATE TABLE "auction_house_locations" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "name" TEXT,
    "type" "AuctionHouseLocationType" NOT NULL DEFAULT 'OTHER',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state_province" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "business_hours" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_house_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_house_documents" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "type" "AuctionHouseDocumentType" NOT NULL,
    "cloud_key" TEXT NOT NULL,
    "private_url" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "license_number" TEXT,
    "jurisdiction" TEXT,
    "expires_at" TIMESTAMP(3),
    "review_status" "AuctionHouseDocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_house_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_house_assets" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "type" "AuctionHouseAssetType" NOT NULL,
    "visibility" "AuctionHouseAssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "cloud_key" TEXT NOT NULL,
    "url" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_house_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_house_memberships" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "AuctionHouseMembershipRole" NOT NULL DEFAULT 'VIEWER',
    "status" "AuctionHouseMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_house_memberships_pkey" PRIMARY KEY ("id")
);

-- Backfill legacy user-to-house assignments. The oldest seller (then lowest ID)
-- is the single owner for each house; additional sellers become viewers.
WITH ranked_sellers AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "auction_house_id"
            ORDER BY "created_at" ASC, "id" ASC
        ) AS "seller_rank"
    FROM "users"
    WHERE "auction_house_id" IS NOT NULL
      AND "role" = 'SELLER'
)
INSERT INTO "auction_house_memberships" (
    "id",
    "auction_house_id",
    "user_id",
    "role",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    'backfill_' || md5("u"."auction_house_id" || ':' || "u"."id"),
    "u"."auction_house_id",
    "u"."id",
    CASE
        WHEN "u"."role" = 'SELLER' AND "rs"."seller_rank" = 1 THEN 'OWNER'::"AuctionHouseMembershipRole"
        WHEN "u"."role" = 'AUCTIONEER' THEN 'AUCTION_MANAGER'::"AuctionHouseMembershipRole"
        ELSE 'VIEWER'::"AuctionHouseMembershipRole"
    END,
    'ACTIVE'::"AuctionHouseMembershipStatus",
    "u"."created_at",
    CURRENT_TIMESTAMP
FROM "users" AS "u"
LEFT JOIN "ranked_sellers" AS "rs" ON "rs"."id" = "u"."id"
WHERE "u"."auction_house_id" IS NOT NULL;

-- CreateTable
CREATE TABLE "auction_house_invitations" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "role" "AuctionHouseMembershipRole" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "status" "AuctionHouseInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_house_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_releases" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "source_reference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PayoutReleaseStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_by_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "stripe_transfer_id" TEXT,
    "stripe_error" TEXT,
    "stripe_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auction_houses_onboarding_status_idx" ON "auction_houses"("onboarding_status");

-- CreateIndex
CREATE INDEX "auction_houses_onboarding_reviewed_by_id_idx" ON "auction_houses"("onboarding_reviewed_by_id");

-- CreateIndex
CREATE INDEX "auction_houses_stripe_connect_status_idx" ON "auction_houses"("stripe_connect_status");

-- CreateIndex
CREATE UNIQUE INDEX "auction_houses_stripe_connect_account_id_key" ON "auction_houses"("stripe_connect_account_id");

-- CreateIndex
CREATE INDEX "auction_house_locations_auction_house_id_idx" ON "auction_house_locations"("auction_house_id");

-- CreateIndex
CREATE INDEX "auction_house_locations_auction_house_id_is_primary_idx" ON "auction_house_locations"("auction_house_id", "is_primary");

-- CreateIndex
CREATE INDEX "auction_house_documents_auction_house_id_idx" ON "auction_house_documents"("auction_house_id");

-- CreateIndex
CREATE INDEX "auction_house_documents_type_idx" ON "auction_house_documents"("type");

-- CreateIndex
CREATE INDEX "auction_house_documents_review_status_idx" ON "auction_house_documents"("review_status");

-- CreateIndex
CREATE INDEX "auction_house_documents_reviewed_by_id_idx" ON "auction_house_documents"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "auction_house_assets_auction_house_id_idx" ON "auction_house_assets"("auction_house_id");

-- CreateIndex
CREATE INDEX "auction_house_assets_type_idx" ON "auction_house_assets"("type");

-- CreateIndex
CREATE INDEX "auction_house_assets_visibility_idx" ON "auction_house_assets"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "auction_house_memberships_user_id_auction_house_id_key" ON "auction_house_memberships"("user_id", "auction_house_id");

-- CreateIndex
CREATE INDEX "auction_house_memberships_auction_house_id_idx" ON "auction_house_memberships"("auction_house_id");

-- CreateIndex
CREATE INDEX "auction_house_memberships_user_id_idx" ON "auction_house_memberships"("user_id");

-- CreateIndex
CREATE INDEX "auction_house_memberships_role_idx" ON "auction_house_memberships"("role");

-- CreateIndex
CREATE INDEX "auction_house_memberships_status_idx" ON "auction_house_memberships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "auction_house_invitations_token_hash_key" ON "auction_house_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "auction_house_invitations_auction_house_id_idx" ON "auction_house_invitations"("auction_house_id");

-- CreateIndex
CREATE INDEX "auction_house_invitations_email_idx" ON "auction_house_invitations"("email");

-- CreateIndex
CREATE INDEX "auction_house_invitations_status_idx" ON "auction_house_invitations"("status");

-- CreateIndex
CREATE INDEX "auction_house_invitations_invited_by_id_idx" ON "auction_house_invitations"("invited_by_id");

-- CreateIndex
CREATE INDEX "auction_house_invitations_accepted_by_id_idx" ON "auction_house_invitations"("accepted_by_id");

-- CreateIndex
CREATE INDEX "auction_house_invitations_expires_at_idx" ON "auction_house_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "payout_releases_stripe_transfer_id_key" ON "payout_releases"("stripe_transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_releases_stripe_idempotency_key_key" ON "payout_releases"("stripe_idempotency_key");

-- CreateIndex
CREATE INDEX "payout_releases_auction_house_id_idx" ON "payout_releases"("auction_house_id");

-- CreateIndex
CREATE INDEX "payout_releases_status_idx" ON "payout_releases"("status");

-- CreateIndex
CREATE INDEX "payout_releases_requested_by_id_idx" ON "payout_releases"("requested_by_id");

-- CreateIndex
CREATE INDEX "payout_releases_approved_by_id_idx" ON "payout_releases"("approved_by_id");

-- CreateIndex
CREATE INDEX "payout_releases_source_reference_idx" ON "payout_releases"("source_reference");

-- AddForeignKey
ALTER TABLE "auction_houses" ADD CONSTRAINT "auction_houses_onboarding_reviewed_by_id_fkey" FOREIGN KEY ("onboarding_reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_locations" ADD CONSTRAINT "auction_house_locations_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_documents" ADD CONSTRAINT "auction_house_documents_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_documents" ADD CONSTRAINT "auction_house_documents_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_assets" ADD CONSTRAINT "auction_house_assets_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_memberships" ADD CONSTRAINT "auction_house_memberships_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_memberships" ADD CONSTRAINT "auction_house_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_invitations" ADD CONSTRAINT "auction_house_invitations_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_invitations" ADD CONSTRAINT "auction_house_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_house_invitations" ADD CONSTRAINT "auction_house_invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_releases" ADD CONSTRAINT "payout_releases_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_releases" ADD CONSTRAINT "payout_releases_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_releases" ADD CONSTRAINT "payout_releases_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
