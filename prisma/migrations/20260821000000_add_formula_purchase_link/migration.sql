-- F1: confirmed-purchasing-link state (schema only — no behaviour yet).
--
-- The Amazon link is the admin's monthly purchasing tool, and a wrong link means
-- the wrong formula bought every month. purchaseUrlConfirmedAt is the ONLY
-- safe-to-purchase signal: the mother must confirm the exact product before an
-- admin can purchase from it. The link lives on the episode (months 2-6 reuse
-- the same product); the delivery records what actually happened that month.
--
-- pendingPurchaseUrl is used ONLY for a stage bump (she confirms new stage +
-- new product together) so the current confirmed link stays purchasable during
-- the transition. A correction instead overwrites purchaseUrl and clears the
-- confirmation immediately, because a known-wrong link must never stay live.
--
-- Additive and safe on existing rows: every column is nullable except
-- purchaseUrlReminderCount, which carries a DEFAULT 0 that backfills.

-- AlterTable
ALTER TABLE "FormulaEpisode"
  ADD COLUMN     "purchaseUrl" TEXT,
  ADD COLUMN     "purchaseUrlSetAt" TIMESTAMP(3),
  ADD COLUMN     "purchaseUrlSetByAdminId" TEXT,
  ADD COLUMN     "purchaseUrlSentAt" TIMESTAMP(3),
  ADD COLUMN     "purchaseUrlConfirmedAt" TIMESTAMP(3),
  ADD COLUMN     "purchaseUrlDeclinedAt" TIMESTAMP(3),
  ADD COLUMN     "purchaseUrlDeclineNote" TEXT,
  ADD COLUMN     "purchaseUrlReminderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "purchaseUrlReminderSentAt" TIMESTAMP(3),
  ADD COLUMN     "blockedAdminNotifiedAt" TIMESTAMP(3),
  ADD COLUMN     "blockedAdminEscalatedAt" TIMESTAMP(3),
  ADD COLUMN     "pendingPurchaseUrl" TEXT;

-- AlterTable
ALTER TABLE "FormulaDelivery"
  ADD COLUMN     "purchasedAt" TIMESTAMP(3),
  ADD COLUMN     "purchasedByAdminId" TEXT,
  ADD COLUMN     "purchaseUrlAtPurchase" TEXT;
