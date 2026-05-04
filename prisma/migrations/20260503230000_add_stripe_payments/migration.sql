-- AlterTable: add Stripe tracking fields and change default status to PENDING
ALTER TABLE "RegisterItemFunding" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "RegisterItemFunding" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "RegisterItemFunding" ADD COLUMN "stripeSessionId" TEXT;
ALTER TABLE "RegisterItemFunding" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"FundingStatus";

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeEvent_eventId_key" ON "StripeEvent"("eventId");
