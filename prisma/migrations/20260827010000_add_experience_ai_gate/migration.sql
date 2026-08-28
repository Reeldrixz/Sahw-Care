-- AI final gate for Experiences: a second, independent safety check that runs
-- AFTER a human reviewer approves, before the post is published.
--
-- Defense in depth. A hazard must pass BOTH gates: the human reading against the
-- infant-safety checklist, and this. Either alone can stop a post. The AI is a
-- backstop on the PUBLISH path only — it is invoked solely inside the approve
-- action, so it never sees content a human declined, can never publish anything
-- on its own, never writes rejectionReasonForAuthor, and never contacts the
-- mother. A flagged post produces no message to her at all; from her side
-- nothing has happened yet.
--
-- AI_FLAGGED is human-approved-then-stopped: not published, and not a verdict
-- about her. It is a request that the reviewer look once more at one specific
-- passage. All four review actions stay available from that state, because the
-- second look may rightly turn an approve into a decline, a send-back or a hold
-- rather than merely confirming.
--
-- Publishing over a flag requires a second, deliberate click and is recorded in
-- aiConfirmedByAdminId / aiConfirmedAt. The flag is not a soft warning that can
-- be clicked past in the same motion as the original approve — that is the
-- difference between a second gate and a speed bump.
--
-- FAIL-OPEN BY DESIGN. If the check cannot run (no ANTHROPIC_API_KEY, an error,
-- a timeout) the post publishes and aiVerdict records UNAVAILABLE. The human is
-- the primary gate and has already approved, so failing open degrades to exactly
-- the human-only safety that exists today — whereas failing closed would let one
-- missing key silently freeze every mother's post in the queue. Fail-open, but
-- never silent: the state is stored and surfaced in the queue.
--
-- Posts only for now. Comments are shorter, contextual, and attach to a post
-- that has already been reviewed, so the per-item value is lower and the
-- footprint would double. The same columns can be added to ExperienceComment
-- later by exactly this additive pattern if real comment traffic warrants it.
--
-- PURELY ADDITIVE: one enum value, six nullable columns. Zero drops, no
-- defaults required, no existing row affected.

-- AlterEnum
-- Appended (plain ADD VALUE) so the Postgres value order matches schema.prisma.
-- Postgres 12+ allows this inside a transaction as long as the new value is not
-- used in the same transaction; nothing below references it.
ALTER TYPE "ExperienceStatus" ADD VALUE 'AI_FLAGGED';

-- AlterTable
ALTER TABLE "Experience"
  ADD COLUMN "aiCheckedAt"          TIMESTAMP(3),
  ADD COLUMN "aiVerdict"            TEXT,
  ADD COLUMN "aiNote"               TEXT,
  ADD COLUMN "aiFlags"              JSONB,
  ADD COLUMN "aiConfirmedByAdminId" TEXT,
  ADD COLUMN "aiConfirmedAt"        TIMESTAMP(3);
