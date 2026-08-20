-- Products are the finished items a shared recipe can produce.
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Batch" ADD COLUMN "productId" TEXT;

CREATE UNIQUE INDEX "Product_recipeId_name_key" ON "Product"("recipeId", "name");
CREATE INDEX "Product_organizationId_archivedAt_idx" ON "Product"("organizationId", "archivedAt");
CREATE INDEX "Product_recipeId_archivedAt_idx" ON "Product"("recipeId", "archivedAt");
CREATE INDEX "Batch_productId_idx" ON "Batch"("productId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
