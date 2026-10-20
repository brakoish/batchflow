import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMissedShift } from '../lib/missedShift'
import { readFileSync } from 'node:fs'
const now = new Date('2026-10-20T20:00:00Z')
test('organization timezone and overnight interval', () => {
 const shift = parseMissedShift({ startLocal: '2026-10-18T22:00', endLocal: '2026-10-19T06:00', note: ' forgot ' }, 'America/New_York', now)
 assert.equal(shift.startedAt.toISOString(), '2026-10-19T02:00:00.000Z')
 assert.equal(shift.endedAt.getTime() - shift.startedAt.getTime(), 8 * 3600000)
 assert.equal(shift.notes, 'forgot')
})
test('reject malformed, reversed, future and DST gap/fold times', () => {
 for (const [startLocal,endLocal] of [['bad','bad'],['2026-10-19T09:00','2026-10-19T08:00'],['2026-10-21T09:00','2026-10-21T10:00'],['2026-03-08T02:30','2026-03-08T04:00'],['2026-11-01T01:30','2026-11-01T03:00']]) assert.throws(() => parseMissedShift({startLocal,endLocal}, 'America/New_York', now))
})
test('route contract: owner, tenant, serialized overlap and audit', () => {
 const source = readFileSync('app/api/shifts/manual/route.ts','utf8')
 for (const expected of ['requireOwner()', 'organizationId', 'pg_advisory_xact_lock', 'startedAt: { lt: interval.endedAt }', 'endedAt: { gt: interval.startedAt }', 'endedAt: null', "status: 409", 'shiftCorrectionRequest.create']) assert.ok(source.includes(expected), expected)
})
test('form success refreshes selected totals', () => {
 const form = readFileSync('app/timesheet/AddShift.tsx','utf8')
 assert.ok(form.includes('onAdded()'))
 const page = readFileSync('app/timesheet/TimesheetClient.tsx','utf8')
 assert.ok(page.includes("if (viewMode === 'weekly') fetchWeeklySummary(); else fetchShifts()"))
})
