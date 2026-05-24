-- AlterTable: add personaStatus to track Persona inquiry state for retry UI
ALTER TABLE "User" ADD COLUMN "personaStatus" TEXT;
