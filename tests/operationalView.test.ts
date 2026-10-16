import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getProducedBaseUnits } from '../lib/inventory'
import { stockAfterAdjustments, isCurrentHoursQuery } from '../lib/operationalView'
const source = (path: string) => readFileSync(path, 'utf8')

test('finished totals exclude leading ENTRY/CHECK/upstream/skipped steps and convert units', () => {
  assert.equal(getProducedBaseUnits([
    { name: 'Weight', type: 'ENTRY', order: 0, completedQuantity: 1 },
    { name: 'Check', type: 'CHECK', order: 1, completedQuantity: 1 },
    { name: 'Fill', type: 'COUNT', order: 2, completedQuantity: 100 },
    { name: 'Cases', type: 'COUNT', order: 3, completedQuantity: 6, unitRatio: 10 },
    { name: '[Skipped] Ship', type: 'COUNT', order: 4, completedQuantity: 999 },
  ]), 60)
})

test('stock recount 10→8→0→5 preserves ledger deltas and is order independent', () => {
  assert.equal(stockAfterAdjustments(10, [-2]), 8)
  assert.equal(stockAfterAdjustments(10, [-2, -8]), 0)
  assert.equal(stockAfterAdjustments(10, [-2, -8, 5]), 5)
  assert.equal(stockAfterAdjustments(10, [-8, 5, -2]), 5)
})

test('initial, filter-change, offline and rejected hours never present stale totals', () => {
  assert.equal(Boolean(isCurrentHoursQuery('', 'A', true, '')), false)
  assert.equal(Boolean(isCurrentHoursQuery('A', 'B', false, '')), false)
  assert.equal(Boolean(isCurrentHoursQuery('A', 'A', false, '500/offline')), false)
  assert.equal(Boolean(isCurrentHoursQuery('A', 'A', false, '')), true)
  const hours = source('app/timesheet/TimesheetClient.tsx')
  assert.match(hours, /if \(id !== requestId.current\) return/)
  assert.match(hours, /if \(!res.ok\) throw new Error\('Hours unavailable/)
  assert.match(hours, /queryReady && \(viewMode/)
})

test('active fixed short runs expose finish without changing target; draft presets do not submit', () => {
  const detail = source('app/batches/[id]/BatchDetailClient.tsx')
  assert.match(detail, /batch.status === 'ACTIVE' && \(\s*<button[\s\S]*?handleStatusChange\('COMPLETED'\)/)
  assert.match(detail, /\{producedBaseUnits.toLocaleString\(\)\} \{batch.baseUnit\} produced/)
  const quick = detail.slice(detail.indexOf('  const handleQuickAmount'), detail.indexOf('  const handleSubmit'))
  assert.match(quick, /setQuantity\(String\(amount\)\)/)
  assert.doesNotMatch(quick, /submitLog/)
  assert.match(detail, /inputMode="none"/)
  assert.match(detail, /useDialogFocus\(finishDialogRef/)
})

test('stock retains zero items and links after physical correction; lists respect chosen sort', () => {
  const stock = source('app/stock/page.tsx')
  assert.doesNotMatch(stock, /filter\(\(product\) => product.onHand > 0\)/)
  assert.match(stock, /historical balances; physical count above is authoritative/)
  const batches = source('app/batches/BatchListClient.tsx')
  assert.match(batches, /visibleBatches.filter\(isBatchReady\)/)
  assert.match(batches, /sortBy === 'newest'/)
  assert.doesNotMatch(batches, /filteredBatches.sort\(compareRecordedActiveFirst\)/)
  assert.match(batches, /filteredBatches.map\(renderBatch\)/)
})

test('all shift surfaces subscribe to updates and My Day formats with response timezone', () => {
  for (const path of ['app/shift/ShiftScreen.tsx', 'app/workers/me/MyDayClient.tsx', 'app/batches/BatchListClient.tsx']) {
    assert.match(source(path), /addEventListener\('shift-changed'/)
  }
  assert.match(source('app/shift/ShiftScreen.tsx'), /if \(!shift\) \{ setElapsed\('0h 00m'\)/)
  const day = source('app/workers/me/MyDayClient.tsx')
  assert.match(day, /localDateKey\(log.createdAt, responseTimezone\)/)
  assert.match(day, /formatTimeInTz\(activeShift.startedAt, timezone\)/)
  assert.match(day, /dataError \? <div role="alert"/)
})
