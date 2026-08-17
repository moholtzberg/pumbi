-- CreateEnum
CREATE TYPE "LoginSecurityOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "login_security_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "attempted_email" TEXT,
    "outcome" "LoginSecurityOutcome" NOT NULL,
    "device_id_hash" CHAR(64),
    "ip_address" TEXT,
    "ip_hash" CHAR(64),
    "country_code" TEXT,
    "region" TEXT,
    "city" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_security_events_user_id_created_at_idx" ON "login_security_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "login_security_events_device_id_hash_created_at_idx" ON "login_security_events"("device_id_hash", "created_at");

-- CreateIndex
CREATE INDEX "login_security_events_ip_hash_created_at_idx" ON "login_security_events"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "login_security_events_outcome_created_at_idx" ON "login_security_events"("outcome", "created_at");

-- CreateIndex
CREATE INDEX "login_security_events_created_at_idx" ON "login_security_events"("created_at");

-- AddForeignKey
ALTER TABLE "login_security_events" ADD CONSTRAINT "login_security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
