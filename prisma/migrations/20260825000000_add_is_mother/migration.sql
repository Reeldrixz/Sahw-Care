-- Self-declared motherhood — the eligibility basis for the Experiences space.
--
-- Two columns because one cannot express three states: never asked, asked and
-- declined, and declared. Without motherhoodDeclaredAt, "no" and "not yet asked"
-- collapse and we would re-prompt someone who already declined.
--
-- Additive and safe: both columns default to the "never asked" state.

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN     "isMother" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "motherhoodDeclaredAt" TIMESTAMP(3);

-- Backfill: users who chose pregnant/postpartum at onboarding already told us
-- they are mothers, in substance. Re-asking a postpartum mother whether she is a
-- mother would be absurd, so this is derived rather than re-collected.
-- motherhoodDeclaredAt stays NULL to record that it was DERIVED, not asked.
--
-- Donors are deliberately NOT backfilled, even where a journey switch left
-- babyBirthDate or a postpartum stage behind. That residue is data, not consent;
-- every donor gets the explicit ask.
UPDATE "User"
   SET "isMother" = true
 WHERE "journeyType" IN ('pregnant', 'postpartum');
