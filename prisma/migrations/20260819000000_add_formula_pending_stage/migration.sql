-- D/F4: mid-episode "stage-for-growth" proposal fields on FormulaEpisode.
-- Additive and nullable: an admin may propose a new formula STAGE (e.g. Stage
-- 1 -> 2 as the baby ages) which the mother re-confirms before it applies to
-- future fulfillments. formulaStage remains the live spec; the pending* columns
-- hold the not-yet-accepted proposal. Brand/type/form are never touched here.

-- AlterTable
ALTER TABLE "FormulaEpisode" ADD COLUMN     "pendingFormulaStage" TEXT,
ADD COLUMN     "pendingStageRequestedAt" TIMESTAMP(3);
