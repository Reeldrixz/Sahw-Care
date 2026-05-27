-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "accountHoldReason" TEXT;
ALTER TABLE "User" ADD COLUMN "accountHoldAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "accountHoldByAdminId" TEXT;
