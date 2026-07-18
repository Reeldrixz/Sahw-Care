-- Manual/beta sponsor recognition on bundles (additive only).
ALTER TABLE "Bundle" ADD COLUMN "sponsorName" TEXT;
ALTER TABLE "Bundle" ADD COLUMN "sponsorUrl"  TEXT;
