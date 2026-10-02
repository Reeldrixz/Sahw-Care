-- Drop the reverse-direction drift: database objects with no schema model.
--
-- 20260826000000_repair_user_column_drift deliberately left these seven in
-- place, noting that dropping them "is irreversible and needs its own audit".
-- This is that audit's outcome (2026-10-01, read-only, prod and preview alike):
--
--   CategoryCooldown, UrgentOverride      0 rows each
--   User.trustRating                      every row at the default 5.0
--   User.trustFrozen                      every row at the default false
--   User.trustFrozenUntil                 every row null
--   User.urgentOverridesUsed              every row at the default 0
--   User.urgentOverridesResetAt           every row null
--
-- Nothing is lost. None of them is read or written by any server code: the
-- cooldown and urgent-override systems were removed in ec6bf14 (both were
-- decorative, enforced nowhere, and bypassable by opening a new register), and
-- trustRating / trustFrozen* went in the trust-engine rebuild, 509eefb, where
-- trustScore replaced trustRating.
--
-- Why drop rather than leave them: every `prisma migrate diff` against a real
-- database emits DROP statements for these seven, mixed in with whatever the
-- real change is. That is the exact output a hurried copy turns into an
-- accidental drop of something that matters. Removing them makes the diff
-- clean again.
--
-- IF EXISTS throughout: init_baseline creates all seven, but environments have
-- drifted before and this must not fail on one where some are already gone.
-- Dropping each table takes its index and its foreign key to User with it.

DROP TABLE IF EXISTS "CategoryCooldown";
DROP TABLE IF EXISTS "UrgentOverride";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "trustRating",
  DROP COLUMN IF EXISTS "trustFrozen",
  DROP COLUMN IF EXISTS "trustFrozenUntil",
  DROP COLUMN IF EXISTS "urgentOverridesUsed",
  DROP COLUMN IF EXISTS "urgentOverridesResetAt";
