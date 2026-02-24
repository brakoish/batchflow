import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const { id } = await params

    const log = await prisma.progressLog.findUnique({
      where: { id },
      include: { batchStep: true },
    })

    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    // Only the worker who made it or an owner can delete
    if (log.workerId !== session.id && session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Delete the log
    await prisma.progressLog.delete({ where: { id } })

    // Recalculate step total from remaining logs
    const remaining = await prisma.progressLog.aggregate({
      where: { batchStepId: log.batchStepId },
      _sum: { quantity: true },
    })

    const newTotal = remaining._sum.quantity || 0
    const step = log.batchStep

    // Update step
    await prisma.batchStep.update({
      where: { id: step.id },
      data: {
        completedQuantity: newTotal,
        status: newTotal >= step.targetQuantity
          ? 'COMPLETED'
          : newTotal > 0
          ? 'IN_PROGRESS'
          : 'IN_PROGRESS', // keep unlocked even at 0
      },
    })

    // If batch was COMPLETED, revert to ACTIVE
    const batch = await prisma.batch.findUnique({
      where: { id: step.batchId },
      include: { steps: true },
    })

    if (batch && batch.status === 'COMPLETED') {
      const allDone = batch.steps.every((s) =>
        s.id === step.id ? newTotal >= s.targetQuantity : s.completedQuantity >= s.targetQuantity
      )
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
