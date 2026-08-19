ALTER TABLE "Recipe" ADD COLUMN "brand" TEXT;

CREATE INDEX "Recipe_organizationId_brand_idx" ON "Recipe"("organizationId", "brand");
