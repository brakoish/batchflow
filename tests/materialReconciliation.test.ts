import assert from 'node:assert/strict'
import { getMaterialReconciliation } from '../lib/materialReconciliation'

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

console.log('material reconciliation tests passed')
