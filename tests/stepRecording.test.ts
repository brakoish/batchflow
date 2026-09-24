import assert from 'node:assert/strict'
import test from 'node:test'
import { getRecordedStepTotal, parseStepQuantity } from '../lib/stepRecording'

test('entry steps accept decimal starting weights', () => {
  assert.equal(parseStepQuantity('3.25', 'ENTRY'), 3.25)
  assert.equal(parseStepQuantity('0', 'ENTRY'), null)
})

test('count steps stay whole-number only', () => {
  assert.equal(parseStepQuantity('12', 'COUNT'), 12)
  assert.equal(parseStepQuantity('3.25', 'COUNT'), null)
})

test('an entry value completes one workflow step without becoming production quantity', () => {
  assert.equal(getRecordedStepTotal('ENTRY', 3.25), 1)
  assert.equal(getRecordedStepTotal('ENTRY', 0), 0)
  assert.equal(getRecordedStepTotal('COUNT', 12), 12)
})
