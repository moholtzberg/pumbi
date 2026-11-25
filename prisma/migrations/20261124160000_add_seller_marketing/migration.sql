-- CreateEnum
CREATE TYPE "MarketingMessageKind" AS ENUM ('INVITATION', 'UPDATE', 'AUCTION_START', 'LOT_NEXT');

-- CreateEnum
CREATE TYPE "MarketingMessageStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'UNKNOWN', 'CANCELLED');

-- CreateTable
CREATE TABLE "marketing_contacts" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "tags" TEXT,
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "auction_reminders" BOOLEAN NOT NULL DEFAULT true,
    "lot_reminders" BOOLEAN NOT NULL DEFAULT true,
    "reminder_minutes" INTEGER NOT NULL DEFAULT 30,
    "subject" TEXT,
    "message" TEXT,
    "site_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_enrollments" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_messages" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "recipient_user_id" TEXT,
    "lot_id" TEXT,
    "email" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "kind" "MarketingMessageKind" NOT NULL,
    "status" "MarketingMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "subject" TEXT,
    "message" TEXT,
    "provider_id" TEXT,
    "error" TEXT,
    "claimed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_suppressions" (
    "id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_contacts_auction_house_id_subscribed_idx" ON "marketing_contacts"("auction_house_id", "subscribed");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_contacts_auction_house_id_email_key" ON "marketing_contacts"("auction_house_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_campaigns_auction_id_key" ON "marketing_campaigns"("auction_id");

-- CreateIndex
CREATE INDEX "marketing_campaigns_auction_house_id_idx" ON "marketing_campaigns"("auction_house_id");

-- CreateIndex
CREATE INDEX "marketing_enrollments_contact_id_idx" ON "marketing_enrollments"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_enrollments_campaign_id_contact_id_key" ON "marketing_enrollments"("campaign_id", "contact_id");

-- CreateIndex
CREATE INDEX "marketing_messages_status_created_at_idx" ON "marketing_messages"("status", "created_at");

-- CreateIndex
CREATE INDEX "marketing_messages_campaign_id_idx" ON "marketing_messages"("campaign_id");

-- CreateIndex
CREATE INDEX "marketing_messages_contact_id_idx" ON "marketing_messages"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_messages_auction_house_id_email_event_key_key" ON "marketing_messages"("auction_house_id", "email", "event_key");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_suppressions_auction_house_id_email_key" ON "marketing_suppressions"("auction_house_id", "email");

-- AddForeignKey
ALTER TABLE "marketing_contacts" ADD CONSTRAINT "marketing_contacts_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_enrollments" ADD CONSTRAINT "marketing_enrollments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_enrollments" ADD CONSTRAINT "marketing_enrollments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "marketing_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_messages" ADD CONSTRAINT "marketing_messages_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_messages" ADD CONSTRAINT "marketing_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_messages" ADD CONSTRAINT "marketing_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "marketing_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_suppressions" ADD CONSTRAINT "marketing_suppressions_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

