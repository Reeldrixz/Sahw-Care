-- Fundraising feature consent on a mother's Register.
--
-- Whether her Register may be shown to audiences OUTSIDE Kradel during
-- livestreams and other fundraising campaigns. She chooses; nobody chooses for
-- her.
--
-- OPT-IN, AND THE DEFAULT IS WHAT ENFORCES IT. DEFAULT false means every
-- register that already exists and every one created from here starts excluded.
-- There is no opt-out path, and no backfill can opt anyone in by accident —
-- being featured requires a deliberate act, and the absence of that act is
-- indistinguishable from refusal, which is the correct reading.
--
-- CONSENTING REVEALS NOTHING NEW. A Register is already viewable by anyone
-- holding the link, and the featurable pool returns the exact shape
-- fetchPublicRegister already returns — same function, same explicit select,
-- first name only, no contact details, shipment address never selected. This
-- flag governs the CONTEXT she may appear in, not the data that is visible.
-- That is why it is safe for it to be a single boolean.
--
-- featureConsentAt records WHEN she agreed. Consent to be shown outside the
-- platform is the kind of thing that has to be evidenceable later: whether she
-- had agreed before a particular campaign ran, not merely whether she agrees
-- now. A boolean alone cannot answer that question after the fact.
--
-- There is deliberately NO revoked-at column. Revocation is clean — the flag
-- goes false and the timestamp goes null. Keeping a durable record of consent
-- somebody has withdrawn is the opposite of honouring the withdrawal.
--
-- PURELY ADDITIVE: two columns, one with a safe default, one nullable. Zero
-- drops. No existing register is affected, and none becomes featurable.

-- AlterTable
ALTER TABLE "Register"
  ADD COLUMN "featureConsent"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "featureConsentAt" TIMESTAMP(3);
