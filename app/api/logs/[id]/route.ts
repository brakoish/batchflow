import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

const SKIPPED_PREFIX = '[Skipped] '

function isSkippedStep(step: { name: string }) {
  return step.name.startsWith(SKIPPED_PREFIX)
}

function getStepCeilingFromPrevious(
  previousStep: { completedQuantity: number; unitRatio: number | null },
  step: { unitRatio: number | null }
) {
  return Math.floor(
    (previousStep.completedQuantity * (previousStep.unitRatio || 1)) / (step.unitRatio || 1)
  )
}

function isCountStepComplete(
  step: {
    completedQuantity: number
    targetQuantity: number | null
    type: string
    name: string
    status: string
    unitRatio: number | null
  },
  previousStep?: {
    completedQuantity: number
    status: string
    unitRatio: number | null
  } | null
) {
  if (isSkippedStep(step)) return true
  if (step.type === 'CHECK') return step.status === 'COMPLETED'
  if (step.targetQuantity != null && step.completedQuantity >= step.targetQuantity) return true
  if (!previousStep || previousStep.status !== 'COMPLETED') return false

  const ceiling = getStepCeilingFromPrevious(previousStep, step)
  return step.completedQuantity >= ceiling
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
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

    // Only the worker who made it or an owner can edit
    if (log.workerId !== session.user.workerId && session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // At least one field must differ
    if (quantity === log.quantity && note === log.note) {
      return NextResponse.json({ error: 'No changes detected' }, { status: 400 })
    }

    // Create audit log
    await prisma.logAudit.create({
      data: {
        progressLogId: id,
        batchStepId: log.batchStepId,
        workerId: session.user.workerId,
        action: 'edit',
        oldQuantity: log.quantity,
        newQuantity: quantity,
        oldNote: log.note,
        newNote: note,
      },
    })

    // Update the log
    const updatedLog = await prisma.progressLog.update({
      where: { id },
      data: {
        quantity,
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
    })

    const newTotal = totalResult._sum.quantity || 0
    const step = log.batchStep
    const previousStep = [...step.batch.steps]
      .reverse()
      .find((s) => s.order < step.order && s.type !== 'CHECK' && !isSkippedStep(s))
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

    // If batch was COMPLETED and step is no longer complete, revert to ACTIVE
    const batch = await prisma.batch.findUnique({
      where: { id: step.batchId },
      include: { steps: true },
    })

    if (batch && batch.status === 'COMPLETED') {
      const allDone = batch.steps.every((s) => {
        if (isSkippedStep(s)) return true
        const candidate = s.id === step.id
          ? { ...s, completedQuantity: newTotal, status: shouldCompleteStep ? 'COMPLETED' : s.status }
          : s
        const previousCountStep = [...batch.steps]
          .reverse()
          .find((p) => p.order < s.order && p.type !== 'CHECK' && !isSkippedStep(p))
        return isCountStepComplete(candidate, previousCountStep)
      })
      if (!allDone) {
        await prisma.batch.update({
          where: { id: batch.id },
          data: { status: 'ACTIVE', completedDate: null },
        })
      }
    }

    return NextResponse.json({ log: updatedLog, step: updatedStep })
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

    // Only the worker who made it or an owner can delete
    if (log.workerId !== session.user.workerId && session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
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
    })

    const newTotal = remaining._sum.quantity || 0
    const step = log.batchStep
    const previousStep = [...step.batch.steps]
      .reverse()
      .find((s) => s.order < step.order && s.type !== 'CHECK' && !isSkippedStep(s))
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

    // If batch was COMPLETED, revert to ACTIVE
    const batch = await prisma.batch.findUnique({
      where: { id: step.batchId },
      include: { steps: true },
    })

    if (batch && batch.status === 'COMPLETED') {
      const allDone = batch.steps.every((s) => {
        if (isSkippedStep(s)) return true
        const candidate = s.id === step.id
          ? { ...s, completedQuantity: newTotal, status: shouldCompleteStep ? 'COMPLETED' : s.status }
          : s
        const previousCountStep = [...batch.steps]
          .reverse()
          .find((p) => p.order < s.order && p.type !== 'CHECK' && !isSkippedStep(p))
        return isCountStepComplete(candidate, previousCountStep)
      })
      if (!allDone) {
        await prisma.batch.update({
          where: { id: batch.id },
          data: { status: 'ACTIVE', completedDate: null },
        })
      }
    }

    return NextResponse.json({ success: true, newTotal })
  } catch (error) {
    console.error('Delete log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
