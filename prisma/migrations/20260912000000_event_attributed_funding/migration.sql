-- Event-attributed funding: which fundraising event a contribution came THROUGH.
--
-- TRUE ATTRIBUTION, NOT A TIME WINDOW. The cheaper option was to sum everything
-- that happened to featurable registers between an event's startedAt and now,
-- with no schema change at all. It is wrong in four ways, and crucially none of
-- them can be corrected afterwards:
--
--   * it counts strangers — someone's aunt funding from a shared link during the
--     broadcast becomes "raised tonight"
--   * it misses the delayed viewer who watched tonight and paid tomorrow morning
--   * it double-counts when two events run concurrently, each claiming the same
--     contribution
--   * it destroys the information needed to tell those apart, so the number can
--     never be audited or fixed
--
-- A host says "we raised $400 tonight" out loud to an audience. That has to mean
-- it. A smaller accurate number beats a larger unverifiable one, and a figure
-- that cannot be corrected later is worse than no figure.
--
-- NULLABLE because most contributions have no event. That is the ordinary case,
-- not an exception — the column is empty for every register funded outside a
-- broadcast.
--
-- THE VIEWER-FACING LINK CARRIES THE EVENT SLUG, NEVER THE ACCESS TOKEN. The
-- kevt_ token is the host's dashboard credential. Putting it in a URL viewers
-- open would hand every one of them host access, and a host reading it out on
-- air would broadcast it. The slug is documented as granting nothing, which is
-- exactly what makes it safe to carry.
--
-- ON DELETE SET NULL, deliberately. A payment record must outlive an event
-- record: deleting an event may lose the attribution but must never delete or
-- orphan evidence that money changed hands.
--
-- The (fundraisingEventId, status) index exists because event totals are summed
-- live during a broadcast, repeatedly. status is part of the key because every
-- total filters CONFIRMED — which is also how refunds drop out of a total with
-- no decrement logic and no possibility of drift.
--
-- PURELY ADDITIVE: one nullable column, one foreign key, one index. Zero drops,
-- no existing row affected, no contribution attributed retroactively.

-- AlterTable
ALTER TABLE "RegisterItemFunding"
  ADD COLUMN "fundraisingEventId" TEXT;

-- CreateIndex
CREATE INDEX "RegisterItemFunding_fundraisingEventId_status_idx"
  ON "RegisterItemFunding"("fundraisingEventId", "status");

-- AddForeignKey
ALTER TABLE "RegisterItemFunding"
  ADD CONSTRAINT "RegisterItemFunding_fundraisingEventId_fkey"
  FOREIGN KEY ("fundraisingEventId") REFERENCES "FundraisingEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
