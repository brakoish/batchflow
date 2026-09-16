import assert from 'node:assert/strict'
import { getMaterialReconciliation } from '../lib/materialReconciliation'
import { convertMaterialQuantity } from '../lib/materialUnits'

const exact = getMaterialReconciliation([
  { type: 'ISSUE', quantity: 7200 },
  { type: 'RETURN', quantity: 100 },
  { type: 'WASTE', quantity: 100 },
], 500, 1 / 14)
assert.equal(exact.expectedUsed, 7000)
assert.equal(exact.unexplained, 0)

const topUpAndLoss = getMaterialReconciliation([
  { type: 'ISSUE', quantity: 7000 },
  { type: 'ADDITION', quantity: 200 },
  { type: 'RETURN', quantity: 50 },
  { type: 'WASTE', quantity: 25 },
], 500, 1 / 14)
assert.equal(topUpAndLoss.unexplained, 125)
assert.ok((topUpAndLoss.variancePct || 0) > 1.7)

const noConversion = getMaterialReconciliation([{ type: 'ISSUE', quantity: 100 }], 10, null)
assert.equal(noConversion.expectedUsed, null)
assert.equal(noConversion.unexplained, null)

const gramsPerJarInPounds = convertMaterialQuantity(3.5, 'g', 'lb')
assert.ok(gramsPerJarInPounds)
const pounds = getMaterialReconciliation([
  { type: 'ISSUE', quantity: 3 },
], 388, 1 / gramsPerJarInPounds!)
assert.ok(Math.abs((pounds.expectedUsed || 0) - 2.99387752) < 0.000001)
assert.ok(Math.abs((pounds.unexplained || 0) - 0.00612248) < 0.000001)

assert.equal(convertMaterialQuantity(1, 'lb', 'g'), 453.59237)
assert.equal(convertMaterialQuantity(1, 'kg', 'oz')?.toFixed(6), '35.273962')
assert.equal(convertMaterialQuantity(1, 'bag', 'g'), null)

console.log('material reconciliation tests passed')
