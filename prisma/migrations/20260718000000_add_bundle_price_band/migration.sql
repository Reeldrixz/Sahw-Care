-- Add internal/sponsor-facing price banding to bundles (additive only)

-- New enum
CREATE TYPE "PriceBand" AS ENUM ('ESSENTIALS_100', 'CORE_175', 'COMPLETE_250');

-- Nullable columns on existing Bundle table (safe for existing rows)
ALTER TABLE "Bundle" ADD COLUMN "priceBand"      "PriceBand";
ALTER TABLE "Bundle" ADD COLUMN "targetPriceCad" INTEGER;
