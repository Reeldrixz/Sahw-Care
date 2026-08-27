-- Audit trail for the admin override of the referral gate.
--
-- The RECIPIENT (mother) role is referral-only by design. A partner
-- organisation issuing a code IS the vetting step: it is how Kradel knows a
-- mother was referred by someone accountable, rather than self-declaring need.
-- api/user/onboarding refuses to promote anyone who is not already RECIPIENT
-- and routes them to the partner directory instead.
--
-- An admin can now grant that role directly, for the case the referral path
-- cannot serve: a verified mother in front of you with no code to give her.
-- That is a manual bypass of a deliberate safety gate, and a bypass nobody can
-- see afterwards is the kind that gets used casually. These three columns make
-- it legible: who granted it, when, and on what justification.
--
-- Null for every user who came through the normal referral path. A non-null
-- recipientGrantedAt is therefore the precise signal that this account did not
-- go through partner vetting — which is what an auditor, or a future admin
-- wondering why this mother has no referral record, needs to know.
--
-- recipientGrantNote is admin-only and never rendered to the mother. She is
-- told she has access, never that her admission was an exception.
--
-- PURELY ADDITIVE: 3 nullable columns. Zero drops, no defaults needed, no
-- existing row affected.

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "recipientGrantedByAdminId" TEXT,
  ADD COLUMN "recipientGrantedAt"        TIMESTAMP(3),
  ADD COLUMN "recipientGrantNote"        TEXT;
