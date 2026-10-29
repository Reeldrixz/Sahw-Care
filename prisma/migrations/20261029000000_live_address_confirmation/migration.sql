-- AlterTable
ALTER TABLE "Register" ADD COLUMN     "liveAddressRevertPendingAt" TIMESTAMP(3),
ADD COLUMN     "liveAddressSwitchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RegisterAddress" ADD COLUMN     "confirmedAt" TIMESTAMP(3);

