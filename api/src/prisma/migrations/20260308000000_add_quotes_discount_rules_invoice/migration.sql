-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- AlterTable: add discount + invoice fields to Order
ALTER TABLE "Order"
  ADD COLUMN "quoteId"        TEXT,
  ADD COLUMN "discountType"   TEXT,
  ADD COLUMN "discountValue"  DECIMAL(10,2),
  ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "invoiceNumber"  TEXT,
  ADD COLUMN "invoicedAt"     TIMESTAMP(3);

-- CreateTable: Quote
CREATE TABLE "Quote" (
  "id"             TEXT NOT NULL,
  "number"         TEXT NOT NULL,
  "customerId"     TEXT NOT NULL,
  "ambassadorId"   TEXT,
  "createdById"    TEXT NOT NULL,
  "status"         "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal"       DECIMAL(10,2) NOT NULL,
  "deliveryFee"    DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discountType"   TEXT,
  "discountValue"  DECIMAL(10,2),
  "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total"          DECIMAL(10,2) NOT NULL,
  "notes"          TEXT,
  "validUntil"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuoteItem
CREATE TABLE "QuoteItem" (
  "id"        TEXT NOT NULL,
  "quoteId"   TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity"  INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "subtotal"  DECIMAL(10,2) NOT NULL,
  CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DiscountRule
CREATE TABLE "DiscountRule" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "value"       DECIMAL(10,2) NOT NULL,
  "code"        TEXT,
  "minOrder"    DECIMAL(10,2),
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");
CREATE UNIQUE INDEX "DiscountRule_code_key" ON "DiscountRule"("code");
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- AddForeignKey: Quote → User (customer)
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Quote → User (createdBy)
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Quote → Ambassador
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_ambassadorId_fkey"
  FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: QuoteItem → Quote
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: QuoteItem → ProductVariant
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Order → Quote
ALTER TABLE "Order" ADD CONSTRAINT "Order_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
