-- Why a request ended, when it was not a person's choice.
--
-- A PENDING claim the giver never answered has no PickupCoordination row
-- (coordination is only created on acceptance), so it has nowhere to carry the
-- no-fault marker that cancelledById/cancelReason provide for later stages.
-- Without this column the 48h pending-expiry would render to the mother as a
-- plain "Cancelled", reading as though she withdrew.
--
-- Null = an ordinary cancellation by a person. A value = the system expired it.
-- Additive and nullable: safe on existing rows, no backfill.

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "cancelReason" TEXT;
