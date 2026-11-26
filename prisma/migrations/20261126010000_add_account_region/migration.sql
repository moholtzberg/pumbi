ALTER TABLE "users" ADD COLUMN "country" TEXT;
ALTER TABLE "users" ADD COLUMN "preferred_locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "seller_profiles" ADD COLUMN "country" TEXT;
-- Existing auctions retain their original USD amounts; new auctions snapshot the house currency.
ALTER TABLE "auctions" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'usd';
