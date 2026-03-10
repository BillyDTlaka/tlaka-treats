-- UomType enum
CREATE TYPE "UomType" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT', 'LENGTH', 'OTHER');

-- UnitOfMeasure table
CREATE TABLE "UnitOfMeasure" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "name"         TEXT NOT NULL UNIQUE,
  "abbreviation" TEXT NOT NULL UNIQUE,
  "type"         "UomType" NOT NULL DEFAULT 'OTHER',
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Product: add uomId
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "uomId" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_uomId_fkey"
  FOREIGN KEY ("uomId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- StockItem: add uomId, make unit nullable
ALTER TABLE "StockItem" ALTER COLUMN "unit" DROP NOT NULL;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "uomId" TEXT;
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_uomId_fkey"
  FOREIGN KEY ("uomId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RecipeIngredient: add uomId, make unit nullable
ALTER TABLE "RecipeIngredient" ALTER COLUMN "unit" DROP NOT NULL;
ALTER TABLE "RecipeIngredient" ADD COLUMN IF NOT EXISTS "uomId" TEXT;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_uomId_fkey"
  FOREIGN KEY ("uomId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
