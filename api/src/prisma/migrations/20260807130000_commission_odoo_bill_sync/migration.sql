-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "odooBillId" INTEGER,
ADD COLUMN     "odooBillNumber" TEXT,
ADD COLUMN     "odooBillPaymentSyncError" TEXT,
ADD COLUMN     "odooBillPaymentSyncStatus" "OdooSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
ADD COLUMN     "odooBillPaymentSyncedAt" TIMESTAMP(3),
ADD COLUMN     "odooBillStatus" "OdooInvoiceSyncStatus" NOT NULL DEFAULT 'NOT_READY',
ADD COLUMN     "odooBillSyncError" TEXT,
ADD COLUMN     "odooBillSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "odooCommissionAccountCode" TEXT;
