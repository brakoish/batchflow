import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = (path: string) => readFileSync(path, 'utf8')
test('shift writers serialize on the same worker identity', () => {
  for (const path of ['app/api/shifts/route.ts', 'app/api/shifts/corrections/route.ts', 'app/api/shifts/corrections/[id]/route.ts', 'app/api/workers/[id]/route.ts']) assert.match(source(path), /pg_advisory_xact_lock/)
  const review = source('app/api/shifts/corrections/[id]/route.ts')
  assert.ok(review.indexOf('pg_advisory_xact_lock') < review.indexOf("current.status !== 'PENDING'"))
  assert.match(review, /overlap/)
  assert.match(review, /endedAt: current.requestedEnd,/)
})
test('payroll destruction is blocked and exports use stable identity', () => {
  assert.doesNotMatch(source('app/api/shifts/[id]/route.ts'), /shift\.delete\(/)
  assert.match(source('app/api/shifts/[id]/route.ts'), /shiftCorrectionRequest\.create/)
  assert.match(source('app/api/shifts/[id]/route.ts'), /previous interval/)
  assert.match(source('app/api/workers/[id]/route.ts'), /if \(!deleted\).*payroll history/)
  assert.match(source('app/api/timesheet/export/route.ts'), /row\['Worker ID'\]/)
  assert.doesNotMatch(source('app/api/timesheet/export/route.ts'), /sum \+ log.quantity/)
})
