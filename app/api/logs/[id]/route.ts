import { getProducedBaseUnits } from '@/lib/inventory'
import { withOperationalLock } from '@/lib/operationalLock'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { getRecordedStepTotal, isRecordedStepComplete, parseStepQuantity } from '@/lib/stepRecording'

const SKIPPED_PREFIX = '[Skipped] '

function isSkippedStep(step: { name: string }) {
  return step.name.startsWith(SKIPPED_PREFIX)
}

function isCountStepComplete(step: { name: string; type: string; completedQuantity: number; targetQuantity: number | null }, _previousStep?: unknown) {
  if (isSkippedStep(step)) return true
  if (step.type === 'ENTRY') return step.completedQuantity > 0
  if (step.type === 'CHECK') return step.targetQuantity != null && step.completedQuantity >= step.targetQuantity
  return step.targetQuantity != null && step.completedQuantity >= step.targetQuantity
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    return await withOperationalLock(session.user.organizationId, async (prisma) => {
    const { id } = await params
    const { quantity, note } = await request.json()

    const log = await prisma.progressLog.findUnique({
      where: { id },
      include: {
        batchStep: {
          include: {
            batch: { include: { steps: { orderBy: { order: 'asc' } } } },
          },
        },
      },
    })

    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    if (log.batchStep.batch.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    if (log.batchStep.batch.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Reopen this batch before correcting its production logs' }, { status: 409 })
    }

    const nextQuantity = quantity === undefined ? log.quantity : parseStepQuantity(quantity, log.batchStep.type)
    if (nextQuantity === null) {
      return NextResponse.json({ error: log.batchStep.type === 'ENTRY' ? 'Entry must be 0 or greater' : 'Quantity must be a whole number greater than 0' }, { status: 400 })
    }

    // Only the worker who made it or an owner can edit
    if (log.workerId !== session.user.workerId && session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // At least one field must differ
    if (nextQuantity === log.quantity && note === log.note) {
      return NextResponse.json({ error: 'No changes detected' }, { status: 400 })
    }

    const aggregate = await prisma.progressLog.aggregate({ where: { batchStepId: log.batchStepId }, _sum: { quantity: true } })
    const proposedTotal = log.batchStep.type === 'ENTRY' ? 1 : (aggregate._sum.quantity || 0) + (nextQuantity - log.quantity)
    if (log.batchStep.type !== 'ENTRY' && log.batchStep.targetQuantity != null && proposedTotal > log.batchStep.targetQuantity) {
      return NextResponse.json({ error: 'Correction exceeds the station target' }, { status: 400 })
    }
    const removals = await prisma.batchRemoval.aggregate({ where: { batchId: log.batchStep.batchId }, _sum: { quantity: true } })
    const proposedOutput = getProducedBaseUnits(log.batchStep.batch.steps.map(step => step.id === log.batchStepId ? { ...step, completedQuantity: proposedTotal } : step))
    if (proposedOutput < (removals._sum.quantity || 0)) {
      return NextResponse.json({ error: 'Output cannot be reduced below inventory already removed' }, { status: 409 })
    }

    // Create audit log
    await prisma.logAudit.create({
      data: {
        progressLogId: id,
        batchStepId: log.batchStepId,
        workerId: session.user.workerId,
        action: 'edit',
        oldQuantity: log.quantity,
        newQuantity: nextQuantity,
        oldNote: log.note,
        newNote: note,
      },
    })

    // Update the log
    const updatedLog = await prisma.progressLog.update({
      where: { id },
      data: {
        quantity: nextQuantity,
        note,
        editedAt: new Date(),
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Recalculate step total from all logs
    const totalResult = await prisma.progressLog.aggregate({
      where: { batchStepId: log.batchStepId },
      _sum: { quantity: true },
      _count: { _all: true },
    })

    const recordedTotal = totalResult._sum.quantity || 0
    const step = log.batchStep
    const newTotal = getRecordedStepTotal(step.type, recordedTotal, totalResult._count._all > 0)
    const previousStep = [...step.batch.steps]
      .reverse()
      .find((s) => s.order < step.order && s.type === 'COUNT' && !isSkippedStep(s))
    const nextStepState = { ...step, completedQuantity: newTotal }
    const shouldCompleteStep = isCountStepComplete(nextStepState, previousStep)

    // Update step
    const updatedStep = await prisma.batchStep.update({
      where: { id: step.id },
      data: {
        completedQuantity: newTotal,
        status: shouldCompleteStep ? 'COMPLETED' : 'IN_PROGRESS',
      },
    })

    return NextResponse.json({ log: updatedLog, step: updatedStep })
    })
  } catch (error) {
    console.error('Edit log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    return await withOperationalLock(session.user.organizationId, async (prisma) => {
    const { id } = await params

    const log = await prisma.progressLog.findUnique({
      where: { id },
      include: {
        batchStep: {
          include: {
            batch: { include: { steps: { orderBy: { order: 'asc' } } } },
          },
        },
      },
    })

    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    if (log.batchStep.batch.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    if (log.batchStep.batch.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Reopen this batch before deleting production logs' }, { status: 409 })
    }

    // Only the worker who made it or an owner can delete
    if (log.workerId !== session.user.workerId && session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const aggregate = await prisma.progressLog.aggregate({ where: { batchStepId: log.batchStepId }, _sum: { quantity: true } })
    const proposedTotal = log.batchStep.type === 'ENTRY' ? 0 : (aggregate._sum.quantity || 0) + (-log.quantity)
    if (log.batchStep.type !== 'ENTRY' && log.batchStep.targetQuantity != null && proposedTotal > log.batchStep.targetQuantity) {
      return NextResponse.json({ error: 'Correction exceeds the station target' }, { status: 400 })
    }
    const removals = await prisma.batchRemoval.aggregate({ where: { batchId: log.batchStep.batchId }, _sum: { quantity: true } })
    const proposedOutput = getProducedBaseUnits(log.batchStep.batch.steps.map(step => step.id === log.batchStepId ? { ...step, completedQuantity: proposedTotal } : step))
    if (proposedOutput < (removals._sum.quantity || 0)) {
      return NextResponse.json({ error: 'Output cannot be reduced below inventory already removed' }, { status: 409 })
    }

    // Create audit log before deletion
    await prisma.logAudit.create({
      data: {
        progressLogId: id,
        batchStepId: log.batchStepId,
        workerId: session.user.workerId,
        action: 'delete',
        oldQuantity: log.quantity,
        oldNote: log.note,
      },
    })

    // Delete the log
    await prisma.progressLog.delete({ where: { id } })

    // Recalculate step total from remaining logs
    const remaining = await prisma.progressLog.aggregate({
      where: { batchStepId: log.batchStepId },
      _sum: { quantity: true },
      _count: { _all: true },
    })

    const recordedTotal = remaining._sum.quantity || 0
    const step = log.batchStep
    const newTotal = getRecordedStepTotal(step.type, recordedTotal, remaining._count._all > 0)
    const previousStep = [...step.batch.steps]
      .reverse()
      .find((s) => s.order < step.order && s.type === 'COUNT' && !isSkippedStep(s))
    const nextStepState = { ...step, completedQuantity: newTotal }
    const shouldCompleteStep = isCountStepComplete(nextStepState, previousStep)

    // Update step
    await prisma.batchStep.update({
      where: { id: step.id },
      data: {
        completedQuantity: newTotal,
        status: shouldCompleteStep ? 'COMPLETED' : 'IN_PROGRESS',
      },
    })

    return NextResponse.json({ success: true, newTotal })
    })
  } catch (error) {
    console.error('Delete log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
