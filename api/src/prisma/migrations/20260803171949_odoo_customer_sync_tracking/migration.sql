-- CreateEnum
CREATE TYPE "OdooSyncStatus" AS ENUM ('NOT_SYNCED', 'SYNCED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "odooSyncError" TEXT,
ADD COLUMN     "odooSyncStatus" "OdooSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
ADD COLUMN     "odooSyncedAt" TIMESTAMP(3);
