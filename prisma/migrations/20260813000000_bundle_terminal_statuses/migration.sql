-- Terminal statuses for the two-clocks bundle model (Piece B).
-- EXPIRED  : auto — a PENDING application left un-reviewed for 90 days.
-- CANCELLED: mother self-withdrew her own PENDING application.
-- RELEASED : admin released an APPROVED application that couldn't be delivered.
ALTER TYPE "BundleApplicationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "BundleApplicationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "BundleApplicationStatus" ADD VALUE IF NOT EXISTS 'RELEASED';
