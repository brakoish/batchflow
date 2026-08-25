import assert from 'node:assert/strict'
import { parseMaterialQuantity, validateMaterialCloseout } from '../lib/materialValidation'

assert.equal(parseMaterialQuantity('12.5'), 12.5)
assert.equal(parseMaterialQuantity(0), null)
assert.equal(parseMaterialQuantity(0, true), 0)
assert.equal(parseMaterialQuantity(-1, true), null)
assert.deepEqual(validateMaterialCloseout(100, 25, 200), { returned: 100, waste: 25 })
assert.match(validateMaterialCloseout(190, 20, 200).error || '', /cannot exceed 200/)
assert.match(validateMaterialCloseout(-1, 0, 200).error || '', /0 or greater/)
console.log('material validation tests passed')
