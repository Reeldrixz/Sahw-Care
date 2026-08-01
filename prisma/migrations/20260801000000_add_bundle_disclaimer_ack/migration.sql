-- Safety disclaimer acknowledgment on bundle applications. Additive, nullable
-- so existing rows remain valid.
ALTER TABLE "BundleApplication" ADD COLUMN "disclaimerAcknowledgedAt" TIMESTAMP(3);
