-- Impact Creator program (awareness-first). Additive, nullable/defaulted.
ALTER TABLE "User" ADD COLUMN "isCreator"             BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "creatorCodeAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "creatorReferralCode"   TEXT;
ALTER TABLE "User" ADD COLUMN "creatorLinkVisits"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "referredByUserId"      TEXT;

CREATE UNIQUE INDEX "User_creatorReferralCode_key" ON "User"("creatorReferralCode");
