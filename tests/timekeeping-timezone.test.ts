import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromDateTimeLocalString, toDateTimeLocalString, localDateKey } from '../lib/timezone'
const tz = 'America/New_York'
test('resolves post-transition DST times exactly', () => {
  assert.equal(fromDateTimeLocalString('2026-03-08T03:30', tz).toISOString(), '2026-03-08T07:30:00.000Z')
  assert.equal(fromDateTimeLocalString('2026-11-01T02:30', tz).toISOString(), '2026-11-01T07:30:00.000Z')
})
test('rejects nonexistent, ambiguous and malformed payroll local times', () => {
  for (const value of ['2026-03-08T02:30', '2026-11-01T01:30', '2026-02-30T12:00', 'invalid']) assert.throws(() => fromDateTimeLocalString(value, tz))
})
test('midnight uses 00 and day keys follow organization rather than UTC', () => {
  assert.equal(toDateTimeLocalString('2026-10-13T04:00:00Z', tz), '2026-10-13T00:00')
  assert.equal(localDateKey('2026-10-13T01:00:00Z', tz), '2026-10-12')
  assert.equal(fromDateTimeLocalString('2026-10-13T00:00', 'Asia/Kathmandu').toISOString(), '2026-10-12T18:15:00.000Z')
})
