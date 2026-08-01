-- Formula support requests: BETA-safe request intake for verified mothers whose
-- babies are already formula-fed. Additive; reviewed manually in admin.

-- CreateEnum
CREATE TYPE "FormulaRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "FormulaRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formulaBrand" TEXT NOT NULL,
    "formulaType" TEXT NOT NULL,
    "formulaStage" TEXT NOT NULL,
    "babyDob" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "confirmedFormulaFedAt" TIMESTAMP(3) NOT NULL,
    "breastfeedingResourcesRequested" BOOLEAN NOT NULL DEFAULT false,
    "status" "FormulaRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormulaRequest_userId_idx" ON "FormulaRequest"("userId");

-- CreateIndex
CREATE INDEX "FormulaRequest_status_idx" ON "FormulaRequest"("status");

-- AddForeignKey
ALTER TABLE "FormulaRequest" ADD CONSTRAINT "FormulaRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
