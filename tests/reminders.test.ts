import test from 'node:test'
import assert from 'node:assert/strict'
import { isReminderDue } from '../lib/reminders'

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 8, 12, minutes))

test('first reminder waits one full interval after clock-in', () => {
  const input = { shiftStartedAt: at(0), assignmentUpdatedAt: at(-10), lastSentAt: null, intervalMinutes: 30 }
  assert.equal(isReminderDue({ ...input, now: at(29) }), false)
  assert.equal(isReminderDue({ ...input, now: at(30) }), true)
})

test('newly enabled assignment waits one interval even during an older shift', () => {
  const input = { shiftStartedAt: at(0), assignmentUpdatedAt: at(20), lastSentAt: null, intervalMinutes: 15 }
  assert.equal(isReminderDue({ ...input, now: at(34) }), false)
  assert.equal(isReminderDue({ ...input, now: at(35) }), true)
})

test('repeat cadence starts from the last delivered reminder', () => {
  const input = { shiftStartedAt: at(0), assignmentUpdatedAt: at(0), lastSentAt: at(30), intervalMinutes: 30 }
  assert.equal(isReminderDue({ ...input, now: at(59) }), false)
  assert.equal(isReminderDue({ ...input, now: at(60) }), true)
})
