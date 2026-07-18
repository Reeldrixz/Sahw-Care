-- Referral grant flow: partner orgs issue single-use codes that grant the
-- RECIPIENT (mother) role. Additive only.

-- New enum
CREATE TYPE "ReferralCodeStatus" AS ENUM ('UNUSED', 'USED', 'REVOKED');

-- Partner organizations
CREATE TABLE "ReferralPartner" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "orgType"      TEXT NOT NULL,
  "contactEmail" TEXT,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralPartner_pkey" PRIMARY KEY ("id")
);

-- Single-use referral codes
CREATE TABLE "ReferralCode" (
  "id"           TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "partnerId"    TEXT NOT NULL,
  "status"       "ReferralCodeStatus" NOT NULL DEFAULT 'UNUSED',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt"       TIMESTAMP(3),
  "usedByUserId" TEXT,
  "expiresAt"    TIMESTAMP(3),
  "note"         TEXT,
  CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCode_code_key"       ON "ReferralCode"("code");
CREATE INDEX        "ReferralCode_partnerId_idx"  ON "ReferralCode"("partnerId");
CREATE INDEX        "ReferralCode_status_idx"     ON "ReferralCode"("status");

ALTER TABLE "ReferralCode"
  ADD CONSTRAINT "ReferralCode_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
