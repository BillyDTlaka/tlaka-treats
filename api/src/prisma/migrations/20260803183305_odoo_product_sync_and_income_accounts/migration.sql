-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "odooIncomeAccountCode" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "odooProductSyncError" TEXT,
ADD COLUMN     "odooProductSyncStatus" "OdooSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
ADD COLUMN     "odooProductSyncedAt" TIMESTAMP(3);
