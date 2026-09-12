-- Overlay support on FundraisingEvent: what is on screen, and a change marker.
--
-- currentRegisterId exists because featuring was LOCAL-ONLY UI state. A host
-- could select a register on their dashboard and nothing was persisted, so the
-- broadcast overlay had no way to learn what was being shown. That was a
-- deliberate deferral when the dashboard was built; the overlay is the piece that
-- needs it.
--
-- It is a soft reference rather than a foreign key, on purpose. A register being
-- deleted, closed, or having its consent withdrawn must not block writing to this
-- column or cascade into the event record. The overlay re-resolves the id against
-- the LIVE featurable pool on every frame, so a stale id shows nothing rather
-- than showing a register whose mother has since revoked consent. A foreign key
-- would make the database enforce a relationship the product deliberately does
-- not want to be sticky.
--
-- contributionCounter is the change marker. The overlay streams at a 2s interval,
-- and reading one indexed integer is far cheaper than recomputing an aggregate
-- and a register pool thirty times a minute. The loop recomputes only when this
-- has moved, so an idle broadcast costs almost nothing.
--
-- A DEDICATED COUNTER RATHER THAN updatedAt. updatedAt moves for any edit — a
-- status transition, a token rotation, featuring a different register — and the
-- marker has to mean "money arrived" and nothing else. Reusing updatedAt would
-- make the overlay flash a recompute every time an admin touched the row.
--
-- The counter is bumped OUTSIDE the money-recording transaction, never inside it.
-- Phase 1 of the Stripe webhook records the payment and nothing else; the marker
-- bump is a separate, independently failable step. A broadcast animation that
-- does not fire is a cosmetic loss. A payment that rolls back because an
-- animation marker failed would be the bug the three-phase split exists to
-- prevent.
--
-- PURELY ADDITIVE: two columns, one nullable, one defaulted. Zero drops, no
-- existing row affected.

-- AlterTable
ALTER TABLE "FundraisingEvent"
  ADD COLUMN "currentRegisterId"   TEXT,
  ADD COLUMN "contributionCounter" INTEGER NOT NULL DEFAULT 0;
