-- Piece E.2: capture the formula FORM (Powder / Ready-to-feed / Concentrate) at
-- intake, so the mother specifies it herself rather than the admin guessing.
-- Additive and nullable: historical requests predate this field and stay null.

-- AlterTable
ALTER TABLE "FormulaRequest" ADD COLUMN     "formulaForm" TEXT;
