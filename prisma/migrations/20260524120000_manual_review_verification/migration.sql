-- CreateEnum
CREATE TYPE "ManualReviewStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum: add manual review notification types
ALTER TYPE "NotifType" ADD VALUE 'MANUAL_REVIEW_APPROVED';
ALTER TYPE "NotifType" ADD VALUE 'MANUAL_REVIEW_REJECTED';

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "manualReviewStatus"          "ManualReviewStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "manualReviewSubmittedAt"      TIMESTAMP(3),
  ADD COLUMN "manualReviewedAt"             TIMESTAMP(3),
  ADD COLUMN "manualReviewedByAdminId"      TEXT,
  ADD COLUMN "manualReviewRejectionReason"  TEXT;
