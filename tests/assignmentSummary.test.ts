import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignmentSummary } from '../lib/assignmentSummary'
const assignments = Array.from({ length: 14 }, (_, i) => ({ worker: { id: `worker-${i}`, name: `Fixture Person ${i}` } }))
const team = { name: 'Excelsior', members: assignments.map(a => ({ workerId: a.worker.id })) }
test('14 members resolve exact saved team independent of order', () => {
  assert.equal(assignmentSummary([...assignments].reverse(), [team]), 'Excelsior')
})
test('never infer a team from a subset, superset, or same-sized different set', () => {
  assert.equal(assignmentSummary(assignments.slice(1), [team]), '13 people')
  assert.equal(assignmentSummary([...assignments, { worker: { id: 'other', name: 'Other' } }], [team]), '15 people')
  assert.equal(assignmentSummary([...assignments.slice(1), { worker: { id: 'other', name: 'Other' } }], [team]), '14 people')
})
test('ambiguous teams and unmatched large selections use counts; small selections retain names', () => {
  assert.equal(assignmentSummary(assignments, [team, { ...team, name: 'Other team' }]), '14 people')
  assert.equal(assignmentSummary(assignments), '14 people')
  assert.equal(assignmentSummary(assignments.slice(0, 2)), 'Fixture Person 0, Fixture Person 1')
  assert.equal(assignmentSummary([]), 'Needs team')
})
