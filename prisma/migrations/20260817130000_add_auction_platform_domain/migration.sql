-- ExtendEnum
ALTER TYPE "UserRole" ADD VALUE 'PLATFORM_ADMIN';

-- CreateEnum
CREATE TYPE "AuctionType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AuctionRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LotSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- Bring users in sync with the current Prisma schema
ALTER TABLE "users"
    ADD COLUMN "password" TEXT,
    ADD COLUMN "phone" TEXT,
    ADD COLUMN "address" TEXT,
    ADD COLUMN "is_verified_buyer" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "is_verified_bidder" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "reset_password_token" TEXT,
    ADD COLUMN "reset_password_expires" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "platform_policies" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "buyer_terms" TEXT NOT NULL,
    "seller_terms" TEXT NOT NULL,
    "buyer_premium_rate" DECIMAL(7,4) NOT NULL,
    "seller_commission_rate" DECIMAL(7,4) NOT NULL,
    "rate_config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_series" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "auction_type" "AuctionType" NOT NULL DEFAULT 'PRIVATE',
    "timezone" TEXT NOT NULL,
    "recurrence_day_of_month" INTEGER NOT NULL,
    "recurrence_local_time" TEXT NOT NULL,
    "next_run_at" TIMESTAMP(3),
    "submission_cutoff_offset_days" INTEGER NOT NULL DEFAULT 7,
    "auction_start_offset_minutes" INTEGER NOT NULL DEFAULT 0,
    "auction_duration_minutes" INTEGER NOT NULL DEFAULT 1440,
    "registration_open_offset_days" INTEGER NOT NULL DEFAULT 14,
    "registration_close_offset_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_series_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "auctions"
    ADD COLUMN "type" "AuctionType" NOT NULL DEFAULT 'PRIVATE',
    ADD COLUMN "series_id" TEXT,
    ADD COLUMN "series_occurrence_at" TIMESTAMP(3),
    ADD COLUMN "platform_policy_id" TEXT,
    ADD COLUMN "policy_version_snapshot" INTEGER,
    ADD COLUMN "buyer_terms_snapshot" TEXT,
    ADD COLUMN "seller_terms_snapshot" TEXT,
    ADD COLUMN "buyer_premium_rate_snapshot" DECIMAL(7,4),
    ADD COLUMN "seller_commission_rate_snapshot" DECIMAL(7,4),
    ADD COLUMN "rate_config_snapshot" JSONB,
    ADD COLUMN "private_house_name_snapshot" TEXT,
    ADD COLUMN "private_house_buyer_terms_snapshot" TEXT,
    ADD COLUMN "private_house_seller_terms_snapshot" TEXT,
    ADD COLUMN "private_house_buyer_premium_rate_snapshot" DECIMAL(7,4),
    ADD COLUMN "private_house_seller_commission_rate_snapshot" DECIMAL(7,4),
    ADD COLUMN "private_house_rate_config_snapshot" JSONB;

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "legal_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_submissions" (
    "id" TEXT NOT NULL,
    "seller_profile_id" TEXT NOT NULL,
    "auction_series_id" TEXT,
    "auction_id" TEXT,
    "status" "LotSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT,
    "meta_fields" TEXT,
    "requested_starting_bid" DECIMAL(12,2),
    "requested_bid_increment" DECIMAL(12,2),
    "accepted_policy_id" TEXT,
    "accepted_policy_version" INTEGER,
    "accepted_seller_terms_snapshot" TEXT,
    "terms_accepted_at" TIMESTAMP(3),
    "terms_accepted_ip" TEXT,
    "terms_accepted_user_agent" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lot_submissions_pkey" PRIMARY KEY ("id")
);

-- Bring lots in sync with the current schema and add submission ownership
ALTER TABLE "lots"
    ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "is_ready" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "watchers_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "submitting_seller_profile_id" TEXT,
    ADD COLUMN "submission_id" TEXT,
    ADD COLUMN "owner_user_id" TEXT;

-- CreateTable
CREATE TABLE "lot_notes" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "content" TEXT,
    "summary" TEXT,
    "audio_url" TEXT,
    "transcription" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lot_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_registrations" (
    "id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AuctionRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "accepted_policy_id" TEXT,
    "accepted_policy_version" INTEGER,
    "accepted_buyer_terms_snapshot" TEXT,
    "terms_accepted_at" TIMESTAMP(3),
    "terms_accepted_ip" TEXT,
    "terms_accepted_user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_is_verified_buyer_idx" ON "users"("is_verified_buyer");

-- CreateIndex
CREATE INDEX "users_is_verified_bidder_idx" ON "users"("is_verified_bidder");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_policies_version_key" ON "platform_policies"("version");

-- CreateIndex
CREATE INDEX "platform_policies_is_active_effective_from_idx" ON "platform_policies"("is_active", "effective_from");

-- CreateIndex
CREATE INDEX "platform_policies_created_by_id_idx" ON "platform_policies"("created_by_id");

-- CreateIndex
CREATE INDEX "auction_series_auction_house_id_idx" ON "auction_series"("auction_house_id");

-- CreateIndex
CREATE INDEX "auction_series_created_by_id_idx" ON "auction_series"("created_by_id");

-- CreateIndex
CREATE INDEX "auction_series_next_run_at_idx" ON "auction_series"("next_run_at");

-- CreateIndex
CREATE INDEX "auction_series_is_active_idx" ON "auction_series"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "auctions_series_id_series_occurrence_at_key" ON "auctions"("series_id", "series_occurrence_at");

-- CreateIndex
CREATE INDEX "auctions_series_id_idx" ON "auctions"("series_id");

-- CreateIndex
CREATE INDEX "auctions_platform_policy_id_idx" ON "auctions"("platform_policy_id");

-- CreateIndex
CREATE INDEX "auctions_type_idx" ON "auctions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_user_id_key" ON "seller_profiles"("user_id");

-- CreateIndex
CREATE INDEX "lot_submissions_seller_profile_id_idx" ON "lot_submissions"("seller_profile_id");

-- CreateIndex
CREATE INDEX "lot_submissions_auction_series_id_idx" ON "lot_submissions"("auction_series_id");

-- CreateIndex
CREATE INDEX "lot_submissions_auction_id_idx" ON "lot_submissions"("auction_id");

-- CreateIndex
CREATE INDEX "lot_submissions_status_idx" ON "lot_submissions"("status");

-- CreateIndex
CREATE INDEX "lot_submissions_accepted_policy_id_idx" ON "lot_submissions"("accepted_policy_id");

-- CreateIndex
CREATE INDEX "lot_submissions_reviewed_by_id_idx" ON "lot_submissions"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "lots_submission_id_key" ON "lots"("submission_id");

-- CreateIndex
CREATE INDEX "lots_position_idx" ON "lots"("position");

-- CreateIndex
CREATE INDEX "lots_submitting_seller_profile_id_idx" ON "lots"("submitting_seller_profile_id");

-- CreateIndex
CREATE INDEX "lots_owner_user_id_idx" ON "lots"("owner_user_id");

-- CreateIndex
CREATE INDEX "lot_notes_lot_id_idx" ON "lot_notes"("lot_id");

-- CreateIndex
CREATE INDEX "lot_notes_created_at_idx" ON "lot_notes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "auction_registrations_auction_id_user_id_key" ON "auction_registrations"("auction_id", "user_id");

-- CreateIndex
CREATE INDEX "auction_registrations_auction_id_idx" ON "auction_registrations"("auction_id");

-- CreateIndex
CREATE INDEX "auction_registrations_user_id_idx" ON "auction_registrations"("user_id");

-- CreateIndex
CREATE INDEX "auction_registrations_status_idx" ON "auction_registrations"("status");

-- CreateIndex
CREATE INDEX "auction_registrations_reviewed_by_id_idx" ON "auction_registrations"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "auction_registrations_accepted_policy_id_idx" ON "auction_registrations"("accepted_policy_id");

-- AddForeignKey
ALTER TABLE "platform_policies" ADD CONSTRAINT "platform_policies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_series" ADD CONSTRAINT "auction_series_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_series" ADD CONSTRAINT "auction_series_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "auction_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_platform_policy_id_fkey" FOREIGN KEY ("platform_policy_id") REFERENCES "platform_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_submissions" ADD CONSTRAINT "lot_submissions_seller_profile_id_fkey" FOREIGN KEY ("seller_profile_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_submissions" ADD CONSTRAINT "lot_submissions_auction_series_id_fkey" FOREIGN KEY ("auction_series_id") REFERENCES "auction_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_submissions" ADD CONSTRAINT "lot_submissions_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_submissions" ADD CONSTRAINT "lot_submissions_accepted_policy_id_fkey" FOREIGN KEY ("accepted_policy_id") REFERENCES "platform_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_submissions" ADD CONSTRAINT "lot_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_submitting_seller_profile_id_fkey" FOREIGN KEY ("submitting_seller_profile_id") REFERENCES "seller_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "lot_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_notes" ADD CONSTRAINT "lot_notes_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_accepted_policy_id_fkey" FOREIGN KEY ("accepted_policy_id") REFERENCES "platform_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
