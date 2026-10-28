-- AlterTable
ALTER TABLE "FulfillmentQueue" ADD COLUMN     "orderId" TEXT;

-- CreateTable
CREATE TABLE "FulfillmentOrder" (
    "id" TEXT NOT NULL,
    "registerId" TEXT,
    "orderNumber" TEXT,
    "totalCents" INTEGER NOT NULL,
    "taxCents" INTEGER,
    "trackingUrl" TEXT,
    "estimatedDeliveryOn" DATE NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FulfillmentOrder_registerId_idx" ON "FulfillmentOrder"("registerId");

-- CreateIndex
CREATE INDEX "FulfillmentQueue_orderId_idx" ON "FulfillmentQueue"("orderId");

-- AddForeignKey
ALTER TABLE "FulfillmentQueue" ADD CONSTRAINT "FulfillmentQueue_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FulfillmentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentOrder" ADD CONSTRAINT "FulfillmentOrder_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentOrder" ADD CONSTRAINT "FulfillmentOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentOrder" ADD CONSTRAINT "FulfillmentOrder_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

