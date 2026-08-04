-- AlterEnum
ALTER TYPE "CommissionStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "odooPaymentSyncError" TEXT,
ADD COLUMN     "odooPaymentSyncStatus" "OdooSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
ADD COLUMN     "odooPaymentSyncedAt" TIMESTAMP(3);
