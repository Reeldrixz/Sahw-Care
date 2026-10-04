-- FlaggedPost.hiddenByUserId / hiddenAt: who hid a reported circle post by
-- deleting it, and when.
--
-- Deleting a post that has open reports no longer hard-deletes it (which
-- cascaded to its queue entry and reports and erased the record of the
-- report). When its author or a circle leader deletes it, the post is hidden
-- instead and its review stays with an admin; these columns record which of
-- them did it. An admin deleting such a post is a removal, recorded in
-- reviewedByAdminId (20261007000000), not here.
--
-- DDL is the hiddenAt / hiddenByUserId part of a read-only `prisma migrate
-- diff --from-url <prod> --to-schema-datamodel`; the same statement there
-- also adds reviewedByAdminId, which belongs to 20261007000000 and is not yet
-- on prod. Additive only: two nullable columns, soft reference, no FK.

-- AlterTable
ALTER TABLE "FlaggedPost" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenByUserId" TEXT;
