-- CreateTable
CREATE TABLE "SavedRegister" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedRegister_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedRegister_userId_idx" ON "SavedRegister"("userId");

-- CreateIndex
CREATE INDEX "SavedRegister_registerId_idx" ON "SavedRegister"("registerId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedRegister_userId_registerId_key" ON "SavedRegister"("userId", "registerId");

-- AddForeignKey
ALTER TABLE "SavedRegister" ADD CONSTRAINT "SavedRegister_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRegister" ADD CONSTRAINT "SavedRegister_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

