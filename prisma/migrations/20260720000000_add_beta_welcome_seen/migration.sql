-- One-time beta welcome note flag (additive, nullable).
ALTER TABLE "User" ADD COLUMN "betaWelcomeSeenAt" TIMESTAMP(3);
