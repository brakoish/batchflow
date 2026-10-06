ALTER TABLE "Recipe" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Product" ADD COLUMN "materialWeightGrams" DOUBLE PRECISION;
ALTER TABLE "Batch" ADD COLUMN "variationId" TEXT;

CREATE TABLE "ProductVariation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductVariation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVariation_productId_name_key" ON "ProductVariation"("productId", "name");
CREATE INDEX "ProductVariation_productId_archivedAt_idx" ON "ProductVariation"("productId", "archivedAt");
CREATE INDEX "Recipe_organizationId_category_archivedAt_idx" ON "Recipe"("organizationId", "category", "archivedAt");
CREATE INDEX "Batch_variationId_idx" ON "Batch"("variationId");

ALTER TABLE "ProductVariation" ADD CONSTRAINT "ProductVariation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Classify existing reusable workflows without touching any batch snapshot.
UPDATE "Recipe" SET "category" = CASE
  WHEN lower("name") LIKE '%pre roll%' OR lower("name") LIKE '%pre-roll%' THEN
    CASE WHEN lower("name") LIKE '%pack%' OR lower("name") LIKE '%tin%' THEN 'PRE_ROLL_PACK' ELSE 'PRE_ROLL' END
  WHEN lower("name") LIKE '%cart%' OR lower("name") LIKE '%vape%' OR lower("name") LIKE '%dab go%' THEN 'VAPE'
  WHEN lower("name") LIKE '%edible%' OR lower("name") LIKE '%gumm%' THEN 'EDIBLE'
  WHEN lower("name") LIKE '%hash%' OR lower("name") LIKE '%rosin%' OR lower("name") LIKE '%charas%' THEN 'CONCENTRATE'
  WHEN lower("name") LIKE '%jar%' OR lower("name") LIKE '%bag%' OR lower("name") LIKE '%pouch%' OR lower("name") LIKE '%flower%' THEN 'FLOWER'
  ELSE 'OTHER'
END
WHERE "name" <> '__batchflow_batch_overrides';

-- Backfill only weights that are explicit in the established workflow name.
UPDATE "Product" AS p SET "materialWeightGrams" = CASE
  WHEN lower(r."name") LIKE '%1/8th%' THEN 3.5
  WHEN lower(r."name") LIKE '%14g%' THEN 14
  WHEN lower(r."name") LIKE '%14pk half gram%' THEN 7
  WHEN lower(r."name") LIKE '%half gram 5 pack%' THEN 2.5
  WHEN lower(r."name") LIKE '%1g pre roll%' OR lower(r."name") LIKE '%single pre roll%' THEN 1
  WHEN lower(r."name") LIKE '%0.5g cartridge%' THEN 0.5
  WHEN lower(r."name") LIKE '%4g hash brick%' THEN 4
  WHEN lower(r."name") LIKE '%0.25g%' THEN 0.25
  ELSE p."materialWeightGrams"
END
FROM "Recipe" AS r
WHERE p."recipeId" = r."id";

-- Strengthen future flower workflows only. Existing BatchStep snapshots are untouched.
INSERT INTO "RecipeStep" ("id", "recipeId", "name", "order", "notes", "type", "entryUnit")
SELECT 'category-input-' || md5(r."id"), r."id", 'Record input weight', 0,
       'Weigh all starting flower before production begins.', 'ENTRY', 'g'
FROM "Recipe" r
WHERE r."category" = 'FLOWER'
  AND NOT EXISTS (
    SELECT 1 FROM "RecipeStep" s
    WHERE s."recipeId" = r."id" AND s."type" = 'ENTRY'
      AND (lower(s."name") LIKE '%input%' OR lower(s."name") LIKE '%starting material%' OR lower(s."name") LIKE '%weigh%')
      AND lower(s."name") NOT LIKE '%waste%' AND lower(s."name") NOT LIKE '%shake%'
  );

-- Put the chosen input measurement first for every migrated Flower template.
UPDATE "RecipeStep" chosen
SET "order" = 0
FROM (
  SELECT DISTINCT ON (s."recipeId") s."id"
  FROM "RecipeStep" s
  JOIN "Recipe" r ON r."id" = s."recipeId"
  WHERE r."category" = 'FLOWER' AND s."type" = 'ENTRY'
    AND (lower(s."name") LIKE '%input%' OR lower(s."name") LIKE '%starting material%' OR lower(s."name") LIKE '%weigh%')
    AND lower(s."name") NOT LIKE '%waste%' AND lower(s."name") NOT LIKE '%shake%'
  ORDER BY s."recipeId", s."order", s."id"
) input
WHERE chosen."id" = input."id";

UPDATE "RecipeStep" input
SET "entryUnit" = 'g'
FROM "Recipe" r
WHERE input."recipeId" = r."id" AND r."category" = 'FLOWER' AND input."order" = 0 AND input."type" = 'ENTRY';

INSERT INTO "RecipeStep" ("id", "recipeId", "name", "order", "notes", "type", "entryUnit")
SELECT 'category-waste-' || md5(r."id"), r."id", 'Record waste weight',
       COALESCE((SELECT max(s."order") + 1 FROM "RecipeStep" s WHERE s."recipeId" = r."id"), 1),
       'Enter waste in grams. Enter 0 when there was no waste.', 'ENTRY', 'g'
FROM "Recipe" r
WHERE r."category" = 'FLOWER'
  AND NOT EXISTS (
    SELECT 1 FROM "RecipeStep" s
    WHERE s."recipeId" = r."id" AND s."type" = 'ENTRY' AND lower(s."name") LIKE '%waste%'
  );

-- Waste is always the final touch point in migrated Flower templates.
UPDATE "RecipeStep" waste
SET "order" = ordered.last_order + 1
FROM (
  SELECT r."id" AS recipe_id, COALESCE(max(non_waste."order"), 0) AS last_order
  FROM "Recipe" r
  LEFT JOIN "RecipeStep" non_waste ON non_waste."recipeId" = r."id" AND lower(non_waste."name") NOT LIKE '%waste%'
  WHERE r."category" = 'FLOWER'
  GROUP BY r."id"
) ordered
WHERE waste."recipeId" = ordered.recipe_id AND waste."type" = 'ENTRY' AND lower(waste."name") LIKE '%waste%';

UPDATE "RecipeStep" waste
SET "entryUnit" = 'g'
FROM "Recipe" r
WHERE waste."recipeId" = r."id" AND r."category" = 'FLOWER' AND waste."type" = 'ENTRY' AND lower(waste."name") LIKE '%waste%';

-- Only convert historical strain data that is already structured and unambiguous.
INSERT INTO "ProductVariation" ("id", "productId", "name", "createdAt")
SELECT 'legacy-variation-' || md5(source.product_id || ':' || source.normalized_name), source.product_id, source.display_name, CURRENT_TIMESTAMP
FROM (
  SELECT b."productId" AS product_id, lower(trim(b."strain")) AS normalized_name, min(trim(b."strain")) AS display_name
  FROM "Batch" b
  WHERE b."productId" IS NOT NULL AND b."strain" IS NOT NULL AND trim(b."strain") <> ''
  GROUP BY b."productId", lower(trim(b."strain"))
) source
ON CONFLICT ("productId", "name") DO NOTHING;

UPDATE "Batch" b
SET "variationId" = v."id"
FROM "ProductVariation" v
WHERE b."productId" = v."productId" AND lower(trim(b."strain")) = lower(v."name") AND b."variationId" IS NULL;

CREATE TABLE "BatchCompletionReport" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variationName" TEXT,
    "batchName" TEXT NOT NULL,
    "receivedGrams" DOUBLE PRECISION,
    "producedUnits" INTEGER NOT NULL,
    "producedUnitLabel" TEXT NOT NULL,
    "gramsPerUnit" DOUBLE PRECISION,
    "producedGrams" DOUBLE PRECISION,
    "shakeGrams" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wasteGrams" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "missingLabels" INTEGER NOT NULL DEFAULT 0,
    "issues" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchCompletionReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BatchCompletionReport_batchId_key" ON "BatchCompletionReport"("batchId");
CREATE INDEX "BatchCompletionReport_completedAt_idx" ON "BatchCompletionReport"("completedAt");
ALTER TABLE "BatchCompletionReport" ADD CONSTRAINT "BatchCompletionReport_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
