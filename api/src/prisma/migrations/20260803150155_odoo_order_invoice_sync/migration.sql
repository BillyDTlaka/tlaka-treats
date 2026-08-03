-- CreateEnum
CREATE TYPE "OdooInvoiceSyncStatus" AS ENUM ('NOT_READY', 'READY', 'SYNCING', 'DRAFT_CREATED', 'POSTED', 'PAID', 'FAILED', 'RECONCILIATION_ISSUE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "odooInvoiceId" INTEGER,
ADD COLUMN     "odooInvoiceNumber" TEXT,
ADD COLUMN     "odooInvoiceStatus" "OdooInvoiceSyncStatus" NOT NULL DEFAULT 'NOT_READY',
ADD COLUMN     "odooInvoiceSyncError" TEXT,
ADD COLUMN     "odooInvoiceSyncedAt" TIMESTAMP(3),
ADD COLUMN     "orderNumber" TEXT,
ADD COLUMN     "orderSeq" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "odooProductId" INTEGER,
ADD COLUMN     "odooProductReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_odooInvoiceStatus_idx" ON "Order"("odooInvoiceStatus");
