CREATE TYPE "SellerBusinessType" AS ENUM ('INDIVIDUAL', 'BUSINESS');
ALTER TABLE "seller_profiles" ADD COLUMN "business_type" "SellerBusinessType" NOT NULL DEFAULT 'INDIVIDUAL';
