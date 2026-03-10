-- StockMovementType new values
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'PRODUCTION_OUTPUT';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'ORDER_FULFILLMENT';

-- PackagingStatus enum
CREATE TYPE "PackagingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- Recipe yield fields
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "outputProductId" TEXT;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "yieldPerBatch" DECIMAL(10,3) NOT NULL DEFAULT 0;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_outputProductId_fkey"
  FOREIGN KEY ("outputProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PackagingRun
CREATE TABLE "PackagingRun" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "productionRunId" TEXT NOT NULL UNIQUE,
  "status"          "PackagingStatus" NOT NULL DEFAULT 'PENDING',
  "batchCount"      INTEGER NOT NULL DEFAULT 1,
  "notes"           TEXT,
  "completedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackagingRun_productionRunId_fkey"
    FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- PackagingRunItem
CREATE TABLE "PackagingRunItem" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "packagingRunId" TEXT NOT NULL,
  "stockItemId"    TEXT NOT NULL,
  "quantity"       DECIMAL(10,3) NOT NULL,
  CONSTRAINT "PackagingRunItem_packagingRunId_fkey"
    FOREIGN KEY ("packagingRunId") REFERENCES "PackagingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagingRunItem_stockItemId_fkey"
    FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
