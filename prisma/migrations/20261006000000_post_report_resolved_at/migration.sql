-- PostReport.resolvedAt: when an admin approves a reported circle post, its
-- reports are marked resolved rather than deleted. A resolved report is kept as
-- a record, no longer counts as open, and stops the same mother re-queuing the
-- post: only a mother who has not reported that post before can send an
-- approved post back for review.
--
-- DDL is verbatim from a read-only `prisma migrate diff --from-url <prod>
-- --to-schema-datamodel` (that diff also lists RecipientGrantBasisChange, which
-- has its own migration, 20261005000000, not yet on prod). Additive only: one
-- nullable column, so every existing report starts unresolved.

-- AlterTable
ALTER TABLE "PostReport" ADD COLUMN     "resolvedAt" TIMESTAMP(3);
