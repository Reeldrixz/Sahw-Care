-- FundraisingEvent: a live event run by a HOST, showing registers that mothers
-- have opted in to being featured.
--
-- NAMING. "host", never "creator". That word already means two other things in
-- this codebase: Register.creatorId is the MOTHER who created the register, and
-- User.isCreator is the Impact Creator programme, which has accounts and its own
-- dashboard at /api/creators/dashboard. A third meaning for the same word is
-- exactly the identityVerified-versus-docStatus collision that has already cost
-- real hours here, so it is avoided before it can start.
--
-- A HOST HAS NO KRADEL ACCOUNT. Access is an unguessable bearer token carried in
-- a link, following the ReferralCode pattern but deliberately stronger: 16
-- random bytes (~128 bits) against the ~39 bits used for a single-use partner
-- invite. That difference is intentional. A referral code is handed to one
-- mother and consumed once; an event link may be pasted into a chat, stay live
-- for hours, and grant a broad read of the featurable pool. It is sized for what
-- it actually is.
--
-- accessToken is NULLABLE, and that is the revocation mechanism. Null means
-- there is no working link — either none was ever issued, or it was revoked.
-- Revoking sets the column to null so the credential ceases to exist rather than
-- being marked dead in place: a token still stored is a token that can still
-- leak. tokenRevokedAt keeps "revoked" and "never issued" distinguishable, and
-- rotation is the same operation with a fresh value.
--
-- slug is unique but is NOT a credential. Knowing it grants nothing; the token
-- is the only thing that authorises.
--
-- DELIBERATELY NOT BUILT ON THE EXISTING Campaign MODEL. Campaign is
-- sponsor-funded bundles — sponsorName, costPerBundle, bundlesRemaining, bound
-- to BundleTemplate — and no code references it anywhere. Overloading dead
-- schema from an abandoned direction to mean something new is how a model ends
-- up unable to answer the questions asked of it later. Campaign is left exactly
-- as it is; removing it is a separate cleanup.
--
-- NO FEATURED-REGISTER JOIN TABLE, on purpose. Featured registers are read LIVE
-- from fetchFeaturableRegisters() while an event runs, so that a mother who
-- revokes consent mid-stream drops out on the very next poll. Pinning a list
-- here would keep showing her after she withdrew, which is the one outcome the
-- consent flag exists to prevent. A snapshot for reproducible post-event results
-- is taken at event END and needs its own model, which does not exist yet.
--
-- PURELY ADDITIVE: one enum, one table, two unique indexes, one status index.
-- Zero drops. No existing table is touched.

-- CreateEnum
CREATE TYPE "FundraisingEventStatus" AS ENUM ('DRAFT', 'LIVE', 'ENDED');

-- CreateTable
CREATE TABLE "FundraisingEvent" (
    "id"             TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "slug"           TEXT NOT NULL,
    "hostName"       TEXT NOT NULL,
    "goalCents"      INTEGER NOT NULL DEFAULT 0,
    "status"         "FundraisingEventStatus" NOT NULL DEFAULT 'DRAFT',
    "accessToken"    TEXT,
    "tokenIssuedAt"  TIMESTAMP(3),
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenRevokedAt" TIMESTAMP(3),
    "startedAt"      TIMESTAMP(3),
    "endedAt"        TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundraisingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundraisingEvent_slug_key" ON "FundraisingEvent"("slug");

-- CreateIndex
-- Unique on a nullable column: Postgres permits many NULLs, so any number of
-- events can sit with no live link while every issued token stays distinct.
CREATE UNIQUE INDEX "FundraisingEvent_accessToken_key" ON "FundraisingEvent"("accessToken");

-- CreateIndex
CREATE INDEX "FundraisingEvent_status_idx" ON "FundraisingEvent"("status");
