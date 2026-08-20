-- D/F4c: natural-completion timestamp on FormulaEpisode. Stamped in the same
-- transaction as the 6th fulfilled delivery (completion is at 6 fulfillments,
-- not 6 calendar months, so this records when it actually finished).
-- Additive and nullable: safe on existing rows, no backfill.

-- AlterTable
ALTER TABLE "FormulaEpisode" ADD COLUMN     "completedAt" TIMESTAMP(3);
