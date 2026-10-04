-- RecipientGrantBasisChange: append-only history of an admin setting or
-- changing recipientGrantBasis on a mother who already holds an admin grant.
--
-- grantRecipient records a basis at grant time, but refuses a user who is
-- already RECIPIENT, so there was no way to record a basis on a grant made
-- before the field existed, or to correct one. The new setGrantBasis admin
-- action does that, and requires a reason. Each change is a row here: the
-- previous basis, the new one, why, and which admin. Rows are never edited, so
-- an earlier justification survives a later change, and the original grant's
-- reason on User.recipientGrantNote is never overwritten.
--
-- DDL is verbatim from a read-only `prisma migrate diff --from-url <prod>
-- --to-schema-datamodel`. Additive only: one new table, one index, one FK.
-- Nothing existing is altered. ON DELETE CASCADE matches the other per-user
-- logs (TrustEvent): the history goes with the account it describes.

-- CreateTable
CREATE TABLE "RecipientGrantBasisChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromBasis" "RecipientGrantBasis",
    "toBasis" "RecipientGrantBasis" NOT NULL,
    "reason" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipientGrantBasisChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipientGrantBasisChange_userId_idx" ON "RecipientGrantBasisChange"("userId");

-- AddForeignKey
ALTER TABLE "RecipientGrantBasisChange" ADD CONSTRAINT "RecipientGrantBasisChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
