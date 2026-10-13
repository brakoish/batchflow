import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getProducedBaseUnits } from '../lib/inventory'
const source = (file: string) => readFileSync(file, 'utf8')

test('finished inventory is the final non-skipped COUNT, never work in process', () => {
  const steps = [
    { name: 'Fill', order: 1, type: 'COUNT', completedQuantity: 100, unitRatio: 1 },
    { name: 'Pack', order: 2, type: 'COUNT', completedQuantity: 0, unitRatio: 10 },
  ]
  assert.equal(getProducedBaseUnits(steps), 0)
  steps[1].completedQuantity = 3
  assert.equal(getProducedBaseUnits(steps), 30)
  assert.equal(getProducedBaseUnits([...steps, { name: '[Skipped] Ship', order: 3, type: 'COUNT', completedQuantity: 500, unitRatio: 1 }]), 30)
})

test('all conflicting mutations share an organization transaction before snapshot reads', () => {
  for (const file of [
    'app/api/batches/[id]/steps/[stepId]/log/route.ts', 'app/api/logs/[id]/route.ts',
    'app/api/batches/[id]/removals/route.ts', 'app/api/stock/count/route.ts',
    'app/api/batches/[id]/steps/route.ts', 'app/api/batches/[id]/steps/[stepId]/route.ts',
  ]) {
    const text = source(file)
    assert.match(text, /withOperationalLock\(session.user.organizationId, async \(prisma\) =>/)
    assert.equal(text.includes('prisma.$transaction'), false)
  }
  const lock = source('lib/operationalLock.ts')
  assert.ok(lock.indexOf('await tx.$executeRaw') < lock.indexOf('return operation(tx)'))
  assert.match(lock, /pg_advisory_xact_lock/)
  assert.match(lock, /ReadCommitted/)
  assert.match(lock, /not idempotency/)
})

test('corrections enforce own target and cannot undo removed output', () => {
  const logs = source('app/api/logs/[id]/route.ts')
  assert.match(logs, /proposedTotal > log.batchStep.targetQuantity/)
  assert.match(logs, /proposedOutput < \(removals._sum.quantity/)
  assert.equal(logs.includes('getStepCeilingFromPrevious'), false)
  const removal = source('app/api/batches/[id]/removals/route.ts')
  assert.match(removal, /getProducedBaseUnits\(batch.steps\)/)
  assert.equal(removal.includes('Math.max(\n    ...countSteps'), false)
})

test('closed lifecycle and historical evidence are guarded', () => {
  const batch = source('app/api/batches/[id]/route.ts')
  assert.match(batch, /existingBatch.status !== 'ACTIVE'/)
  assert.match(batch, /Only an active batch can be finished/)
  assert.equal(batch.includes('batchCompletionReport.delete'), false)
  assert.match(batch, /tx.logAudit.count/)
  assert.match(batch, /tx.batchCompletionReport.count/)
  const step = source('app/api/batches/[id]/steps/[stepId]/route.ts')
  assert.match(step, /step.batch.status !== 'ACTIVE'/)
  assert.match(step, /Recorded steps cannot change type or units/)
})
