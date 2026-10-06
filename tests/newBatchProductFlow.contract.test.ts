import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

test('new batch starts from a product and supports a complete new-product workflow', () => {
  const creator = fs.readFileSync('app/batches/new/BatchCreator.tsx', 'utf8')
  const wizard = fs.readFileSync('app/batches/new/NewProductWizard.tsx', 'utf8')
  const page = fs.readFileSync('app/batches/new/page.tsx', 'utf8')

  assert.match(creator, /Use existing product/)
  assert.match(creator, /Create new product/)
  assert.match(creator, /New strain or flavor/)
  assert.match(creator, /Pick or add a variation/)
  assert.doesNotMatch(creator, /\/api\/recipes\/\$\{selected\.id\}\/products/)

  assert.match(wizard, /Start the steps from/)
  assert.match(wizard, /Copy product/)
  assert.match(wizard, /Start blank/)
  assert.match(wizard, /baseStepsForCategory/)
  assert.match(wizard, /Save product & continue to batch/)
  assert.match(wizard, /fetch\('\/api\/recipes'/)
  assert.match(wizard, /products: \[\{ name: productName\.trim\(\), brand: brand\.trim\(\)/)
  assert.match(wizard, /variations: \[variationName\.trim\(\)\]/)

  // Copying a product workflow needs the step type, measurement unit, and
  // count-unit relation; names alone cannot reproduce worker behavior.
  assert.match(page, /type: true/)
  assert.match(page, /entryUnit: true/)
  assert.match(page, /unit: \{ select: \{ name: true \} \}/)
  assert.match(page, /materials: \{ select: \{ name: true, quantityPerUnit: true, unit: true \} \}/)
  assert.match(wizard, /materials: step\.materials/)
})

test('new product creation leaves existing batch snapshots untouched', () => {
  const wizard = fs.readFileSync('app/batches/new/NewProductWizard.tsx', 'utf8')
  assert.doesNotMatch(wizard, /api\/batches\/[^']+\/steps/)
  assert.doesNotMatch(wizard, /BatchStep/)
  assert.doesNotMatch(wizard, /ProgressLog/)
})
