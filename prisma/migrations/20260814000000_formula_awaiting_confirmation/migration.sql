-- D/F3a: pre-active AWAITING_CONFIRMATION state for formula episodes + the
-- confirmation-gate fields. Additive. The new enum value is only ADDED here
-- (never USED in this migration), so it is safe inside Prisma's migration
-- transaction on PostgreSQL 12+.

-- AlterEnum
ALTER TYPE "FormulaEpisodeStatus" ADD VALUE IF NOT EXISTS 'AWAITING_CONFIRMATION';

-- AlterTable
ALTER TABLE "FormulaEpisode" ADD COLUMN     "formulaForm" TEXT,
ADD COLUMN     "confirmationDeadline" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "correctionNote" TEXT,
ADD COLUMN     "correctionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "reminder7SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder12SentAt" TIMESTAMP(3);
