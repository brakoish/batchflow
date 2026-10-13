import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = (path: string) => readFileSync(path, 'utf8')
test('recording clears the draft and announces success only after acknowledged POST', () => {
  const sourceText = source('app/batches/[id]/BatchDetailClient.tsx')
  const handler = sourceText.slice(sourceText.indexOf('const submitLog ='), sourceText.indexOf('const handleQuickAmount'))
  assert.ok(handler.indexOf('const data = await res.json()') < handler.indexOf("setQuantity('')"))
  assert.ok(handler.indexOf('const data = await res.json()') < handler.indexOf('showToast('))
  assert.match(handler, /Your draft is retained/)
  assert.doesNotMatch(handler, /setBatch\(snapshot\)/)
})
test('blank physical counts are rejected, zero clearing has impact confirmation', () => {
  const count = source('app/stock/StockCountButton.tsx')
  assert.match(count, /explicitCount === undefined && !quantity.trim\(\)/)
  assert.match(count, /window.confirm/)
  assert.match(count, /Correction:/)
})
test('new-product onboarding remains reachable without existing recipes and recipe state refreshes', () => {
  assert.doesNotMatch(source('app/batches/new/page.tsx'), /recipes.length === 0/)
  assert.match(source('app/recipes/RecipesClient.tsx'), /setRecipes\(initialRecipes\)/)
  assert.match(source('app/components/ConfirmModal.tsx'), /role="dialog"/)
})
