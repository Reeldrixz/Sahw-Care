-- Phase 9: Bundle Catalogue + Applications

-- New enums
CREATE TYPE "BundleStage" AS ENUM ('PREGNANCY', 'LABOUR', 'NEWBORN', 'POSTPARTUM');
CREATE TYPE "BundleApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED');

-- Extend NotifType
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'BUNDLE_APPLICATION_APPROVED';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'BUNDLE_APPLICATION_REJECTED';

-- Bundle catalogue table
CREATE TABLE "Bundle" (
  "id"               TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "stage"            "BundleStage" NOT NULL,
  "description"      TEXT NOT NULL,
  "contentsMarkdown" TEXT NOT NULL,
  "estimatedValue"   INTEGER NOT NULL,
  "slotsPerMonth"    INTEGER NOT NULL DEFAULT 10,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Bundle_code_key" ON "Bundle"("code");

-- Bundle applications table
CREATE TABLE "BundleApplication" (
  "id"            TEXT NOT NULL,
  "bundleId"      TEXT NOT NULL,
  "fullName"      TEXT NOT NULL,
  "phone"         TEXT NOT NULL,
  "city"          TEXT NOT NULL,
  "province"      TEXT NOT NULL,
  "dueDate"       TIMESTAMP(3),
  "babyDob"       TIMESTAMP(3),
  "story"         TEXT NOT NULL,
  "streetAddress" TEXT NOT NULL,
  "unit"          TEXT,
  "postalCode"    TEXT NOT NULL,
  "status"        "BundleApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "adminNote"     TEXT,
  "reviewedAt"    TIMESTAMP(3),
  "reviewedBy"    TEXT,
  "userId"        TEXT,
  "dispatchedAt"  TIMESTAMP(3),
  "deliveredAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BundleApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BundleApplication_bundleId_idx" ON "BundleApplication"("bundleId");
CREATE INDEX "BundleApplication_status_idx"   ON "BundleApplication"("status");
CREATE INDEX "BundleApplication_userId_idx"   ON "BundleApplication"("userId");

ALTER TABLE "BundleApplication"
  ADD CONSTRAINT "BundleApplication_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BundleApplication"
  ADD CONSTRAINT "BundleApplication_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
