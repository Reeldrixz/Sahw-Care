-- Formula 6-month episodes + per-month deliveries + capacity config (Pieces D/F).
-- Purely additive: FormulaRequest is untouched, no backfill. New tables carry the
-- admission (FormulaEpisode), the 6 monthly admin-fulfilled deliveries
-- (FormulaDelivery), and a singleton capacity config (FormulaCapacityConfig).

-- CreateEnum
CREATE TYPE "FormulaEpisodeStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ENDED');

-- CreateEnum
CREATE TYPE "FormulaDeliveryStatus" AS ENUM ('SCHEDULED', 'DUE', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FormulaEpisode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originatingRequestId" TEXT,
    "formulaBrand" TEXT NOT NULL,
    "formulaType" TEXT NOT NULL,
    "formulaStage" TEXT NOT NULL,
    "babyDob" TIMESTAMP(3),
    "status" "FormulaEpisodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthsTotal" INTEGER NOT NULL DEFAULT 6,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admittedByAdminId" TEXT,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "endedByAdminId" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaDelivery" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "status" "FormulaDeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledByAdminId" TEXT,
    "formulaStageAtFulfilment" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaCapacityConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "maxActiveEpisodes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaCapacityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormulaEpisode_userId_idx" ON "FormulaEpisode"("userId");

-- CreateIndex
CREATE INDEX "FormulaEpisode_status_idx" ON "FormulaEpisode"("status");

-- CreateIndex
CREATE INDEX "FormulaEpisode_userId_status_idx" ON "FormulaEpisode"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FormulaDelivery_episodeId_monthIndex_key" ON "FormulaDelivery"("episodeId", "monthIndex");

-- CreateIndex
CREATE INDEX "FormulaDelivery_episodeId_idx" ON "FormulaDelivery"("episodeId");

-- CreateIndex
CREATE INDEX "FormulaDelivery_status_idx" ON "FormulaDelivery"("status");

-- AddForeignKey
ALTER TABLE "FormulaEpisode" ADD CONSTRAINT "FormulaEpisode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaDelivery" ADD CONSTRAINT "FormulaDelivery_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "FormulaEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
