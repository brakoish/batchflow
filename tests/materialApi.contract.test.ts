import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const materialRoute = readFileSync('app/api/batches/[id]/materials/route.ts', 'utf8')
const batchRoute = readFileSync('app/api/batches/[id]/route.ts', 'utf8')
const newBatchRoute = readFileSync('app/api/batches/route.ts', 'utf8')

assert.match(materialRoute, /requireSupervisorOrOwner\(\)/, 'material mutations require supervisor or owner')
assert.match(materialRoute, /organizationId: session\.user\.organizationId/, 'batch lookup is organization scoped')
assert.match(materialRoute, /FOR UPDATE/, 'material mutation serializes concurrent requests')
assert.match(materialRoute, /batch\.materialReconciledAt/, 'material mutation rejects changes after reconciliation')
assert.match(materialRoute, /validateMaterialCloseout/, 'closeout validates ledger totals')
assert.match(materialRoute, /type: 'RECONCILE'/, 'closeout always records its note and actor')
assert.doesNotMatch(batchRoute, /Reconcile the issued material before completing this batch/, 'legacy ledgers do not block batch completion')
assert.match(newBatchRoute, /const tracksMaterial = false/, 'new batches do not create reconciliation ledgers')
console.log('material API contract tests passed')
