import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

test('catalog hierarchy and completion reports preserve batch snapshots', () => {
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
  const migration = fs.readFileSync('prisma/migrations/20261006152000_add_product_categories_and_variations/migration.sql', 'utf8')
  const createBatch = fs.readFileSync('app/api/batches/route.ts', 'utf8')
  const finishBatch = fs.readFileSync('app/api/batches/[id]/route.ts', 'utf8')
  const logProgress = fs.readFileSync('app/api/batches/[id]/steps/[stepId]/log/route.ts', 'utf8')
  const editLog = fs.readFileSync('app/api/logs/[id]/route.ts', 'utf8')
  const categoryDefaults = fs.readFileSync('lib/processingCategories.ts', 'utf8')

  assert.match(schema, /category\s+String\s+@default\("OTHER"\)/)
  assert.match(schema, /model ProductVariation/)
  assert.match(schema, /materialWeightGrams\s+Float\?/)
  assert.match(schema, /model BatchCompletionReport/)
  assert.match(createBatch, /variationId: selectedVariation\?\.id \|\| null/)
  assert.match(createBatch, /strain: selectedVariation\?\.name \|\| strain/)
  assert.match(finishBatch, /batchCompletionReport\.create/)
  assert.match(finishBatch, /status === 'COMPLETED' && !body\.completionReport/)
  assert.match(finishBatch, /status === 'ACTIVE' && existingBatch\.completionReport/)
  assert.match(finishBatch, /batchCompletionReport\.delete/)
  assert.match(finishBatch, /producedGrams: gramsPerUnit == null \? null : producedUnits \* gramsPerUnit/)
  assert.doesNotMatch(logProgress, /status:\s*'COMPLETED',[\s\S]{0,120}completedDate:/)
  assert.match(editLog, /Reopen this batch before correcting its production logs/)
  assert.match(editLog, /Reopen this batch before deleting production logs/)
  assert.match(categoryDefaults, /Record input weight/)
  assert.match(categoryDefaults, /Record waste weight/)

  // Template-only inserts must target RecipeStep; existing BatchStep snapshots
  // and ProgressLog history are deliberately never rewritten by the migration.
  assert.match(migration, /INSERT INTO "RecipeStep"/)
  assert.match(migration, /GROUP BY b\."productId", lower\(trim\(b\."strain"\)\)/)
  assert.doesNotMatch(migration, /UPDATE "BatchStep"/)
  assert.doesNotMatch(migration, /DELETE FROM "ProgressLog"/)
})
