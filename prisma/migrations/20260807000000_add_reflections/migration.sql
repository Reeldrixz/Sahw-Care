-- Reflections: mother-only long-form writing space in Circles, grouped by stage.
-- Additive; every reflection defaults to PENDING and is admin-reviewed before publish.

-- CreateEnum
CREATE TYPE "ReflectionStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ReflectionStatus" NOT NULL DEFAULT 'PENDING',
    "aiFlagNonReflective" BOOLEAN NOT NULL DEFAULT false,
    "aiFlagCrisis" BOOLEAN NOT NULL DEFAULT false,
    "aiNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionCategory" TEXT,
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reflection_stageKey_status_idx" ON "Reflection"("stageKey", "status");

-- CreateIndex
CREATE INDEX "Reflection_authorId_idx" ON "Reflection"("authorId");

-- CreateIndex
CREATE INDEX "Reflection_status_idx" ON "Reflection"("status");

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
