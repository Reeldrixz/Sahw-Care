-- ReferralCode -> ReferralPartner: ON DELETE CASCADE becomes ON DELETE RESTRICT.
--
-- A used ReferralCode is the only record of which partner referred a mother:
-- User carries no partner field, so attribution lives in usedByUserId on the
-- code. Under CASCADE, deleting a partner silently deleted every code it had
-- issued, and with them the referral history of every mother it brought in.
--
-- RESTRICT rather than SET NULL on purpose. SET NULL would keep the code row
-- but blank out partnerId, which is the very fact worth keeping. A partner that
-- should stop issuing codes is retired with active=false; deletion now fails
-- while it has any codes.

ALTER TABLE "ReferralCode" DROP CONSTRAINT "ReferralCode_partnerId_fkey";

ALTER TABLE "ReferralCode"
  ADD CONSTRAINT "ReferralCode_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
