-- Register guided-tour "seen" flag, account-level (follows the user across devices)
ALTER TABLE "User" ADD COLUMN "tourCompletedAt" TIMESTAMP(3);
