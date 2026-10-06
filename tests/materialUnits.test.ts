import assert from 'node:assert/strict'
import { convertMaterialQuantity, formatWeightConversion } from '../lib/materialUnits'

assert.equal(convertMaterialQuantity(1360.77711, 'g', 'lb'), 3)
assert.equal(convertMaterialQuantity(3, 'lb', 'g'), 1360.77711)
assert.equal(formatWeightConversion(1360.77711, 'g'), '3 lb')
assert.equal(formatWeightConversion(3, 'lb'), '1,360.78 g')
assert.equal(formatWeightConversion(10, 'custom'), null)

console.log('material unit tests passed')
