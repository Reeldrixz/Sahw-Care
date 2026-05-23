-- CreateEnum
CREATE TYPE "Layer3Status" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable: add verification v2 fields to User
ALTER TABLE "User"
  -- Layer 1 identity verification
  ADD COLUMN "identityVerified"          BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "personaInquiryId"          TEXT,
  ADD COLUMN "identityVerifiedAt"        TIMESTAMP(3),
  ADD COLUMN "identityOverrideByAdminId" TEXT,
  ADD COLUMN "identityOverrideReason"    TEXT,
  -- Layer 2 risk controls
  ADD COLUMN "riskFlagged"               BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "riskReason"                TEXT,
  ADD COLUMN "shippingHold"              BOOLEAN      NOT NULL DEFAULT false,
  -- Layer 3 escalation
  ADD COLUMN "layer3Status"              "Layer3Status" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "layer3DocumentUrl"         TEXT,
  ADD COLUMN "layer3DocumentType"        TEXT,
  ADD COLUMN "layer3Note"                TEXT,
  ADD COLUMN "layer3ResolvedAt"          TIMESTAMP(3),
  ADD COLUMN "layer3ClearedByAdminId"    TEXT,
  ADD COLUMN "layer3OverrideReason"      TEXT;
