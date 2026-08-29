-- Extend the AI final gate to Experience comments.
--
-- The gate was built posts-only at E4, deliberately: comments are shorter,
-- contextual, and attach to a post that has already been reviewed, so the
-- per-item value looked lower and the footprint would have doubled. That call
-- was made with the note that the same columns could be added later "by exactly
-- this additive pattern if real comment traffic warrants it". Comments are now
-- being written, so it does.
--
-- A comment carries the same hazard class as a post. "Just do what I said
-- above" inherits whatever is above it, and a comment is the easier place to
-- slip something past a tired reviewer precisely because it is short and reads
-- as incidental. A hazard must pass both gates whichever table it lives in.
--
-- The parent post is passed to the check as CONTEXT — a comment cannot be
-- judged without knowing what it replies to — but quotes are validated against
-- the comment body alone, so a flag lifted from the already-reviewed post is
-- dropped rather than blocking the comment.
--
-- Columns mirror Experience exactly, so the two tables stay readable side by
-- side in the queue and the same handling code covers both.
--
-- PURELY ADDITIVE: six nullable columns. Zero drops, no defaults required, no
-- existing row affected. No enum change — AI_FLAGGED already exists on
-- ExperienceStatus, which both models share.

-- AlterTable
ALTER TABLE "ExperienceComment"
  ADD COLUMN "aiCheckedAt"          TIMESTAMP(3),
  ADD COLUMN "aiVerdict"            TEXT,
  ADD COLUMN "aiNote"               TEXT,
  ADD COLUMN "aiFlags"              JSONB,
  ADD COLUMN "aiConfirmedByAdminId" TEXT,
  ADD COLUMN "aiConfirmedAt"        TIMESTAMP(3);
