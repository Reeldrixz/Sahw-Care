-- Live fundraising, step 4: the state the event code will need. Additions only:
-- one enum, new nullable or defaulted columns, three new tables. Nothing
-- existing is altered or dropped, and no data is rewritten.
--
-- FundraisingEvent
--   goalRegisters            the goal as registers fulfilled (0 of 5), not dollars
--   sponsorName,             the sponsor and one bundle's value, for the on-air
--   sponsorBundleValueCents  line "~$200 additional support from <sponsor>"
--   sponsorBundlesReserved,  bundles this event may unlock, and has unlocked;
--   sponsorBundlesUnlocked   the second only moves with an EventBundleUnlock row
--   sponsorConfirmedAt       set by an admin once the sponsor's commitment is
--                            confirmed; while null, no unlock can be recorded
--                            and the overlay's sponsor line can't show
--   hideDonorNames           host switch, usable mid-stream
--
-- RegisterItemFunding
--   displayName              the first name a donor chose to show
--   showNameConsent          her choice; pre-ticked at checkout, so new rows
--                            default to true. Rows that already exist are set to
--                            FALSE: those donors never saw the checkbox. Done by
--                            adding the column with DEFAULT false, then moving
--                            the default to true.
--
-- New tables
--   EventRegisterCompletion  once per (event, register): counts toward the goal
--   EventBundleUnlock        once per register, ever (unique registerId); value
--                            and sponsor copied at unlock; names no mother;
--                            RESTRICT on the event so an event with unlocks
--                            can't be deleted from under its reservation
--   EventCelebration         the overlay queue: unique dedupeKey so a webhook
--                            retry can't create a second copy; shownAt for the
--                            one overlay's atomic claim. Bundle rows carry no
--                            register or item: the moment names no mother.
--
-- No refunds, overflow or feature-period columns (decided against). DDL is
-- from a read-only `prisma migrate diff --from-url <prod> --to-schema-datamodel`,
-- minus Register.featureConsentVersion (its own migration, 20261019000000, not
-- yet on prod), with the showNameConsent default edit described above.

-- CreateEnum
CREATE TYPE "EventCelebrationType" AS ENUM ('ITEM_FUNDED', 'ITEM_FUNDED_BY_ONE', 'REGISTER_COMPLETE', 'BUNDLE_UNLOCKED');

-- AlterTable
ALTER TABLE "FundraisingEvent" ADD COLUMN     "goalRegisters" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hideDonorNames" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sponsorBundleValueCents" INTEGER,
ADD COLUMN     "sponsorBundlesReserved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sponsorBundlesUnlocked" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sponsorConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "sponsorName" TEXT;

-- AlterTable
ALTER TABLE "RegisterItemFunding" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "showNameConsent" BOOLEAN NOT NULL DEFAULT false;

-- Existing contributions keep false (their donors were never asked); every
-- row from here on defaults to true, matching the pre-ticked checkbox.
ALTER TABLE "RegisterItemFunding" ALTER COLUMN "showNameConsent" SET DEFAULT true;

-- CreateTable
CREATE TABLE "EventRegisterCompletion" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegisterCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventBundleUnlock" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registerId" TEXT,
    "valueCents" INTEGER NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventBundleUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCelebration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "EventCelebrationType" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "registerId" TEXT,
    "registerItemId" TEXT,
    "bundleUnlockId" TEXT,
    "donorDisplayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shownAt" TIMESTAMP(3),

    CONSTRAINT "EventCelebration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventRegisterCompletion_eventId_registerId_key" ON "EventRegisterCompletion"("eventId", "registerId");

-- CreateIndex
CREATE UNIQUE INDEX "EventBundleUnlock_registerId_key" ON "EventBundleUnlock"("registerId");

-- CreateIndex
CREATE INDEX "EventBundleUnlock_eventId_idx" ON "EventBundleUnlock"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventCelebration_dedupeKey_key" ON "EventCelebration"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "EventCelebration_bundleUnlockId_key" ON "EventCelebration"("bundleUnlockId");

-- CreateIndex
CREATE INDEX "EventCelebration_eventId_shownAt_createdAt_idx" ON "EventCelebration"("eventId", "shownAt", "createdAt");

-- AddForeignKey
ALTER TABLE "EventRegisterCompletion" ADD CONSTRAINT "EventRegisterCompletion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FundraisingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegisterCompletion" ADD CONSTRAINT "EventRegisterCompletion_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBundleUnlock" ADD CONSTRAINT "EventBundleUnlock_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FundraisingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBundleUnlock" ADD CONSTRAINT "EventBundleUnlock_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCelebration" ADD CONSTRAINT "EventCelebration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FundraisingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCelebration" ADD CONSTRAINT "EventCelebration_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCelebration" ADD CONSTRAINT "EventCelebration_registerItemId_fkey" FOREIGN KEY ("registerItemId") REFERENCES "RegisterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCelebration" ADD CONSTRAINT "EventCelebration_bundleUnlockId_fkey" FOREIGN KEY ("bundleUnlockId") REFERENCES "EventBundleUnlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

