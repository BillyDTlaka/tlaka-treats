-- AlterTable
ALTER TABLE "User" ADD COLUMN "odooPartnerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_odooPartnerId_key" ON "User"("odooPartnerId");
