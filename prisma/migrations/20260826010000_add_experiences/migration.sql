-- Experiences (E2): the data model for the knowledge space where mothers write
-- down what they learned for the mothers who come after them.
--
-- PURELY ADDITIVE: 2 enums, 3 tables, 9 indexes, 5 foreign keys. Zero drops,
-- and nothing outside these objects is touched. The reverse drift left in place
-- by 20260826000000_repair_user_column_drift (trustRating, trustFrozen,
-- trustFrozenUntil, urgentOverridesUsed, urgentOverridesResetAt, and the
-- CategoryCooldown and UrgentOverride tables) is deliberately untouched here
-- too; removing it is a separate decision with its own audit.
--
-- Notes on the shape, since the SQL alone does not explain it:
--
--   * Both Experience and ExperienceComment default to PENDING, not PUBLISHED.
--     Posts AND comments are review-before-publish. This is a baby-safety
--     surface: mothers act on what they read here, so nothing reaches another
--     mother unread by an admin. DRAFT applies to posts only.
--
--   * reviewNote and rejectionReasonForAuthor are two separate columns on
--     purpose. reviewNote is internal and never rendered to the author;
--     rejectionReasonForAuthor is written to be read by her. Collapsing them
--     into one field is how internal moderation language leaks to the person
--     it is about. Same split as the formula decline reasons.
--
--   * reviewedById is a plain column with NO foreign key, matching the schema,
--     which declares it as String? rather than a relation. The review record is
--     an audit fact about what happened; it should outlive the admin account
--     that performed it rather than cascade away with it.
--
--   * helpedCount is denormalised because it is the primary SORT KEY for every
--     browse query and so has to be an indexable column. Exactly one writer
--     moves it, in the same transaction as the ExperienceHelpful insert/delete,
--     which is what keeps it from drifting.
--
--   * Ranking is helpedCount DESC with createdAt ASC as the tiebreak — oldest
--     wins. Deliberately anti-feed: nothing is privileged for being new, and
--     knowledge does not decay. The Experience indexes below serve exactly that
--     ranking plus browse-by-topic and the bounded "recently added" shelf.
--
--   * ExperienceComment is flat — no parentId, no threading. Comments here are
--     for adding what a post missed, not for discussion.
--
--   * ExperienceHelpful carries a unique constraint on (experienceId, userId):
--     one mother, one "this helped", enforced at the database rather than only
--     in application code. That unique index is also the only index the table
--     needs — it already serves experienceId-prefixed lookups, so there is
--     deliberately no standalone index on experienceId to pay for on every
--     insert and delete.

-- CreateEnum
CREATE TYPE "ExperienceStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExperienceTopic" AS ENUM ('FEEDING', 'SLEEP', 'RECOVERY', 'MENTAL_HEALTH', 'MEDICAL', 'LOGISTICS_MONEY', 'RELATIONSHIPS');

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "whatITried" TEXT NOT NULL,
    "takeaway" TEXT NOT NULL,
    "topic" "ExperienceTopic" NOT NULL,
    "stageKey" TEXT,
    "status" "ExperienceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "rejectionReasonForAuthor" TEXT,
    "helpedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceHelpful" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperienceHelpful_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceComment" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ExperienceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "rejectionReasonForAuthor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ExperienceComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Experience_status_topic_helpedCount_idx" ON "Experience"("status", "topic", "helpedCount");

-- CreateIndex
CREATE INDEX "Experience_status_stageKey_idx" ON "Experience"("status", "stageKey");

-- CreateIndex
CREATE INDEX "Experience_status_createdAt_idx" ON "Experience"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Experience_authorId_idx" ON "Experience"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceHelpful_experienceId_userId_key" ON "ExperienceHelpful"("experienceId", "userId");

-- CreateIndex
CREATE INDEX "ExperienceComment_experienceId_status_idx" ON "ExperienceComment"("experienceId", "status");

-- CreateIndex
CREATE INDEX "ExperienceComment_status_idx" ON "ExperienceComment"("status");

-- CreateIndex
CREATE INDEX "ExperienceComment_authorId_idx" ON "ExperienceComment"("authorId");

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceHelpful" ADD CONSTRAINT "ExperienceHelpful_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceHelpful" ADD CONSTRAINT "ExperienceHelpful_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceComment" ADD CONSTRAINT "ExperienceComment_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceComment" ADD CONSTRAINT "ExperienceComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
