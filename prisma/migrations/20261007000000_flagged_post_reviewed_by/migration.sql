-- FlaggedPost.reviewedByAdminId: which admin approved or removed a flagged
-- circle post. reviewedAt already records when; this records who. A soft
-- reference (no foreign key), like identityOverrideByAdminId, so the record
-- of a moderation decision is not altered if that admin account goes.
--
-- DDL is verbatim from a read-only `prisma migrate diff --from-url <prod>
-- --to-schema-datamodel` (that diff also lists objects from earlier
-- migrations not yet on prod; this file adds only its own column).
-- Additive only: one nullable column. Existing reviews stay NULL, meaning
-- "reviewed before this was recorded".

-- AlterTable
ALTER TABLE "FlaggedPost" ADD COLUMN     "reviewedByAdminId" TEXT;
