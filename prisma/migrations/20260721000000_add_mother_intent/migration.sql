-- "Held-open door": account arrived with mother-intent (picked pregnant/
-- postpartum) but is referral-gated and not yet a RECIPIENT. Additive, nullable.
ALTER TABLE "User" ADD COLUMN "motherIntentAt" TIMESTAMP(3);
