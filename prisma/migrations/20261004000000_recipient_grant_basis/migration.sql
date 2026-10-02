-- User.recipientGrantBasis: what an admin recipient grant rested on.
--
-- grantRecipient admits a mother without a partner code. The written reason
-- says why in prose; the basis says, in a form the admin UI can act on, which
-- check the admin's judgement stood in for:
--   ID        — the admin checked her identity directly
--   REFERRAL  — a partner or trusted organisation vouched for her outside the
--               code system
-- The admin badge colours from it (ID green, REFERRAL blue).
--
-- DDL is verbatim from a read-only `prisma migrate diff --from-url <prod>
-- --to-schema-datamodel`. Additive only: one enum, one nullable column.
--
-- Deliberately NO backfill. Grants made before this existed did not record a
-- basis, and inferring one from free-text notes would write a guess into an
-- audit field. They stay NULL and show as "basis not recorded" until an admin
-- sets it. The API requires a basis on every new grant, so NULL can only ever
-- mean a pre-existing grant.

-- CreateEnum
CREATE TYPE "RecipientGrantBasis" AS ENUM ('ID', 'REFERRAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recipientGrantBasis" "RecipientGrantBasis";
