-- Add fee-breakdown columns to RegisterItemFunding
ALTER TABLE "RegisterItemFunding" ADD COLUMN "kradelFee"       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RegisterItemFunding" ADD COLUMN "optionalSupport" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RegisterItemFunding" ADD COLUMN "stripeFee"       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RegisterItemFunding" ADD COLUMN "totalCharged"    INTEGER NOT NULL DEFAULT 0;
