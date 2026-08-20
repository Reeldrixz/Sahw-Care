-- D/F4d: idempotency marker for the single gentle "stage change awaiting your
-- confirmation" reminder (~7 days after a proposal). No hard timeout exists —
-- the safe default is the current stage keeps shipping — so this only guards the
-- one reminder from repeating. Additive and nullable: safe on existing rows.

-- AlterTable
ALTER TABLE "FormulaEpisode" ADD COLUMN     "pendingStageReminderSentAt" TIMESTAMP(3);
