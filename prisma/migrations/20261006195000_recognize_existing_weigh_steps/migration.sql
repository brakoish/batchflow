-- Existing weigh-in names may mention that shake is excluded from the input
-- (for example, "Weigh ... No Smalls or Shake"). That is still the input
-- measurement, not a shake measurement.
WITH established_input AS (
  SELECT DISTINCT ON (s."recipeId") s."id", s."recipeId"
  FROM "RecipeStep" s
  JOIN "Recipe" r ON r."id" = s."recipeId"
  WHERE r."category" = 'FLOWER'
    AND s."type" = 'ENTRY'
    AND s."id" NOT LIKE 'category-input-%'
    AND (lower(s."name") LIKE '%input%' OR lower(s."name") LIKE '%starting material%' OR lower(s."name") LIKE '%weigh%')
    AND lower(s."name") NOT LIKE '%waste%'
  ORDER BY s."recipeId", s."order", s."id"
)
UPDATE "RecipeStep" s
SET "order" = 0, "entryUnit" = 'g'
FROM established_input input
WHERE s."id" = input."id";

DELETE FROM "RecipeStep" canonical
USING "Recipe" r
WHERE canonical."recipeId" = r."id"
  AND r."category" = 'FLOWER'
  AND canonical."id" LIKE 'category-input-%'
  AND NOT EXISTS (SELECT 1 FROM "BatchStep" bs WHERE bs."recipeStepId" = canonical."id")
  AND EXISTS (
    SELECT 1 FROM "RecipeStep" established
    WHERE established."recipeId" = canonical."recipeId"
      AND established."id" NOT LIKE 'category-input-%'
      AND established."type" = 'ENTRY'
      AND (lower(established."name") LIKE '%input%' OR lower(established."name") LIKE '%starting material%' OR lower(established."name") LIKE '%weigh%')
      AND lower(established."name") NOT LIKE '%waste%'
  );
