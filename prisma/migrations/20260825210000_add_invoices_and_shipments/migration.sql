-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'AWAITING_EXTERNAL', 'PENDING_CHECKOUT', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoicePaymentChannel" AS ENUM ('PUMBI_STRIPE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'RATES_READY', 'LABEL_PURCHASED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'FAILURE', 'CANCELLED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "auction_house_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "hammer_price" DECIMAL(14,2) NOT NULL,
    "buyer_premium_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "buyer_premium_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "buyer_pays_shipping" BOOLEAN NOT NULL DEFAULT false,
    "payment_channel" "InvoicePaymentChannel",
    "external_payment_method" TEXT,
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "shippo_shipment_id" TEXT,
    "shippo_rate_id" TEXT,
    "shippo_transaction_id" TEXT,
    "carrier" TEXT,
    "service_level" TEXT,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "label_url" TEXT,
    "shipping_amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "from_name" TEXT,
    "from_street1" TEXT,
    "from_street2" TEXT,
    "from_city" TEXT,
    "from_state" TEXT,
    "from_zip" TEXT,
    "from_country" TEXT,
    "to_name" TEXT,
    "to_street1" TEXT,
    "to_street2" TEXT,
    "to_city" TEXT,
    "to_state" TEXT,
    "to_zip" TEXT,
    "to_country" TEXT,
    "to_phone" TEXT,
    "to_email" TEXT,
    "parcel_weight_oz" DOUBLE PRECISION,
    "parcel_length_in" DOUBLE PRECISION,
    "parcel_width_in" DOUBLE PRECISION,
    "parcel_height_in" DOUBLE PRECISION,
    "rates_json" JSONB,
    "tracking_events_json" JSONB,
    "tracking_status_detail" TEXT,
    "eta" TIMESTAMP(3),
    "labeled_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");
CREATE UNIQUE INDEX "invoices_lot_id_key" ON "invoices"("lot_id");
CREATE UNIQUE INDEX "invoices_stripe_checkout_session_id_key" ON "invoices"("stripe_checkout_session_id");
CREATE UNIQUE INDEX "invoices_stripe_payment_intent_id_key" ON "invoices"("stripe_payment_intent_id");
CREATE INDEX "invoices_buyer_id_status_idx" ON "invoices"("buyer_id", "status");
CREATE INDEX "invoices_auction_house_id_status_idx" ON "invoices"("auction_house_id", "status");
CREATE INDEX "invoices_auction_id_idx" ON "invoices"("auction_id");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

CREATE UNIQUE INDEX "shipments_invoice_id_key" ON "shipments"("invoice_id");
CREATE UNIQUE INDEX "shipments_shippo_transaction_id_key" ON "shipments"("shippo_transaction_id");
CREATE INDEX "shipments_status_idx" ON "shipments"("status");
CREATE INDEX "shipments_tracking_number_idx" ON "shipments"("tracking_number");
CREATE INDEX "shipments_shippo_shipment_id_idx" ON "shipments"("shippo_shipment_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_auction_house_id_fkey" FOREIGN KEY ("auction_house_id") REFERENCES "auction_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
