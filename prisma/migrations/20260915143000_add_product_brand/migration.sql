ALTER TABLE "Product" ADD COLUMN "brand" TEXT;

UPDATE "Product" AS p
SET "brand" = r."brand"
FROM "Recipe" AS r
WHERE p."recipeId" = r."id" AND r."brand" IS NOT NULL;

CREATE INDEX "Product_organizationId_brand_idx" ON "Product"("organizationId", "brand");
