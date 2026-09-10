CREATE TABLE "StockAdjustment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "productId" TEXT,
  "previousQuantity" INTEGER NOT NULL,
  "countedQuantity" INTEGER NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "note" TEXT,
  "actorName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockAdjustment_organizationId_createdAt_idx" ON "StockAdjustment"("organizationId", "createdAt");
CREATE INDEX "StockAdjustment_productId_createdAt_idx" ON "StockAdjustment"("productId", "createdAt");
CREATE INDEX "StockAdjustment_recipeId_createdAt_idx" ON "StockAdjustment"("recipeId", "createdAt");

ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
