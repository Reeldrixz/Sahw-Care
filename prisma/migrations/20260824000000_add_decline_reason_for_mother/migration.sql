-- Mother-facing decline reason. Kept as a SEPARATE column from adminNote, which
-- stays internal triage: this one is sent to her word-for-word, so the two must
-- never share a field. Blank means she receives the warm generic message.
-- Additive and nullable: safe on existing rows, no backfill.

-- AlterTable
ALTER TABLE "FormulaRequest" ADD COLUMN     "declineReasonForMother" TEXT;
