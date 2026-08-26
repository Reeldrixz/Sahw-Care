-- Drift repair: bring the database up to what schema.prisma has long declared.
--
-- The migration history and schema.prisma had diverged: 12 columns, 2 enum
-- values and 7 whole tables existed in the schema but in no migration. They
-- were present in production only because they had been created by an ad-hoc
-- `prisma db push`, which writes to the database without leaving a migration
-- behind. prisma migrate status reported "up to date" throughout, because it
-- only tracks WHICH MIGRATION FILES HAVE RUN -- it never compares the schema to
-- the actual database.
--
-- The gap became visible when the database was rebuilt from the migration
-- history alone: everything db push had created was simply absent, because no
-- migration had ever described it. This migration is that missing description.
--
-- This is not cosmetic. Prisma requests every schema-known column unless given
-- an explicit select, so a bare prisma.user.findFirst() throws, and six real
-- code paths fail:
--   awardTrust / getTrustSummary  -> the 5 point columns below. Called from 12+
--       routes (circle posts and comments, likes, phone verification,
--       registration, referral redeem, fulfilment confirmation). Awaited callers
--       500; fire-and-forget callers swallow the error, so trust scores silently
--       never move.
--   /api/profile/contributor and /share  -> bio
--   /api/profile/impact-share            -> impactCardUnlockedAt
--   /api/user/transition-status          -> survey7DismissedAt
--   /api/register/suggestions            -> suggestionSubmissionDisabled
--   /api/cron/stage-transitions          -> notified30DaysStage
-- and the 7 tables back 47 live prisma.* call sites across missions, bug
-- reports, register suggestions and profile snapshots.
--
-- Types, defaults, indexes and referential actions are taken verbatim from
-- `prisma migrate diff --from-url <prod> --to-schema-datamodel`, which reads the
-- database read-only. Every NOT NULL carries a default, so no existing row can
-- violate one. The point columns default to 0 rather than being nullable, so
-- awardTrust computes a correct total instead of a silently wrong one.
--
-- PURELY ADDITIVE: 12 ADD COLUMN, 2 ADD VALUE, 7 CREATE TABLE, 6 indexes,
-- 8 foreign keys. ZERO drops.
--
-- Deliberately NOT included -- the reverse-direction drift (things that exist in
-- the database but not in the schema): the User columns trustRating,
-- trustFrozen, trustFrozenUntil, urgentOverridesUsed, urgentOverridesResetAt,
-- and the CategoryCooldown and UrgentOverride tables. The generated diff wanted
-- to drop all seven. Prisma ignores unknown columns, so leaving them costs
-- nothing, whereas dropping them is irreversible and needs its own audit. That
-- decision is separate from this repair.
--
-- Also deliberately NOT included: the Experience / ExperienceHelpful /
-- ExperienceComment tables and their two enums. They are unreleased work (E2)
-- and get their own migration, so this one stays a pure repair.

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN     "verificationPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "engagementPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "streakPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "agePoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "fulfilmentPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "survey7Completed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "survey7DismissedAt" TIMESTAMP(3),
  ADD COLUMN     "survey7OptedOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "notified30DaysStage" TEXT,
  ADD COLUMN     "bio" TEXT,
  ADD COLUMN     "impactCardUnlockedAt" TIMESTAMP(3),
  ADD COLUMN     "suggestionSubmissionDisabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum
-- Additive only. Postgres 12+ permits ALTER TYPE ... ADD VALUE inside a
-- transaction provided the new value is not USED in that same transaction;
-- nothing below references either value, so this is safe under migrate deploy.
ALTER TYPE "NotifType" ADD VALUE 'IMPACT_CARD_UNLOCKED';

-- AlterEnum
-- Live in the accepted-category allowlist at
-- src/app/api/circles/[id]/posts/route.ts, so without this a mother posting
-- "Working on" fails at the database.
ALTER TYPE "PostCategory" ADD VALUE 'WORKING_ON';

-- CreateTable
CREATE TABLE "ProfileSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "goalBlocks" INTEGER NOT NULL DEFAULT 40,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionTeam" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "totalBlocks" INTEGER NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MissionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "promotedSkuId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegisterSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionAction" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "blocks" INTEGER NOT NULL,
    "humanLabel" TEXT NOT NULL,
    "referenceId" TEXT,
    "referredByUserId" TEXT,
    "recipientUserId" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "description" TEXT NOT NULL,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "screenshotUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "adminNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileSnapshot_userId_idx" ON "ProfileSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionMember_teamId_userId_key" ON "MissionMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "RegisterSuggestion_status_createdAt_idx" ON "RegisterSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RegisterSuggestion_userId_idx" ON "RegisterSuggestion"("userId");

-- CreateIndex
CREATE INDEX "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BugReport_userId_idx" ON "BugReport"("userId");

-- AddForeignKey
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionTeam" ADD CONSTRAINT "MissionTeam_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionMember" ADD CONSTRAINT "MissionMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "MissionTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionMember" ADD CONSTRAINT "MissionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterSuggestion" ADD CONSTRAINT "RegisterSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAction" ADD CONSTRAINT "MissionAction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "MissionTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAction" ADD CONSTRAINT "MissionAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
