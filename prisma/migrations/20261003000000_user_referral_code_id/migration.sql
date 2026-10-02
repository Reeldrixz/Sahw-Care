-- User.referralCodeId: which partner code a mother redeemed, on the user.
--
-- Until now the only record was ReferralCode.usedByUserId, a soft pointer the
-- other way, so "was she referred, and by whom" took a lookup on an unindexed
-- column. From here consumeReferralCode writes both sides in the redemption
-- transaction; this migration adds the column and fills it for codes already
-- redeemed.
--
-- DDL is verbatim from a read-only `prisma migrate diff --from-url <prod>
-- --to-schema-datamodel`. Additive only: one nullable column, one unique index,
-- one foreign key. No drops, no NOT NULL, so no existing row can violate it.
--
-- ON DELETE RESTRICT: a redeemed code must not be deletable out from under the
-- mother who used it — the same reason ReferralCode -> ReferralPartner became
-- RESTRICT in 20260929000000.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCodeId" TEXT;

-- Backfill, before the index and FK exist so neither is checked row by row
-- mid-update. Only USED codes count: an UNUSED or REVOKED code was never
-- redeemed, whatever usedByUserId says. A user should hold at most one USED
-- code, but nothing in the database has enforced that, so DISTINCT ON takes
-- her earliest redemption rather than leaving the pick to the planner; any
-- later code stays recorded on its own row via usedByUserId. Codes whose
-- usedByUserId points at a deleted user match no User row and are skipped.
UPDATE "User" u
SET    "referralCodeId" = first_code.id
FROM (
  SELECT DISTINCT ON ("usedByUserId") "usedByUserId", id
  FROM   "ReferralCode"
  WHERE  status = 'USED' AND "usedByUserId" IS NOT NULL
  ORDER  BY "usedByUserId", "usedAt" ASC NULLS LAST, id
) AS first_code
WHERE  u.id = first_code."usedByUserId"
  AND  u."referralCodeId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCodeId_key" ON "User"("referralCodeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
