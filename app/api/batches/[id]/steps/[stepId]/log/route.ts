import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

const SKIPPED_PREFIX = '[Skipped] '

function isSkippedStep(step: { name: string }) {
  return step.name.startsWith(SKIPPED_PREFIX)
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
) {
  if (isSkippedStep(step)) return true
  if (step.type === 'CHECK') return step.status === 'COMPLETED'
  if (step.targetQuantity != null && step.completedQuantity >= step.targetQuantity) return true
  return false
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await requireSession()
    const { id: batchId, stepId } = await params
    const { quantity, note } = await request.json()

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      )
    }

    // Get the step with batch and all steps
    const step = await prisma.batchStep.findUnique({
      where: { id: stepId },
      include: {
        batch: {
          include: {
            assignments: {
              select: { workerId: true },
            },
            steps: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    })

    if (!step) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      )
    }

    if (
      step.batchId !== batchId ||
      step.batch.organizationId !== session.user.organizationId ||
      step.batch.status !== 'ACTIVE'
    ) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      )
    }

    if (
      session.user.role === 'WORKER' &&
      step.batch.assignments.length > 0 &&
      !step.batch.assignments.some((assignment: { workerId: string }) => assignment.workerId === session.user.workerId)
    ) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      )
    }

    if (isSkippedStep(step)) {
      return NextResponse.json(
        { error: 'This step is skipped for this batch' },
        { status: 400 }
      )
    }

    // Calculate ceiling (normalize across different unit ratios)
    const newTotal = step.completedQuantity + quantity

    // Each station may record independently. The workflow order is guidance,
    // while the station's own target remains the safety ceiling.
    if (step.targetQuantity != null && newTotal > step.targetQuantity) {
      return NextResponse.json(
        { error: `Cannot exceed target of ${step.targetQuantity}` },
        { status: 400 }
      )
    }

    // Create progress log
    const progressLog = await prisma.progressLog.create({
      data: {
        batchStepId: stepId,
        workerId: session.user.workerId,
        quantity,
        note,
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

    // Create audit log for this creation
    await prisma.logAudit.create({
      data: {
        progressLogId: progressLog.id,
        batchStepId: stepId,
        workerId: session.user.workerId,
        action: 'create',
        newQuantity: quantity,
        newNote: note,
      },
    })

    // Update step completed quantity and status
    // For open-ended steps (targetQuantity is null), never auto-complete
    const nextStepState = {
      ...step,
      completedQuantity: newTotal,
    }
    const shouldCompleteStep = step.targetQuantity != null && (
      newTotal >= step.targetQuantity ||
      isCountStepComplete(nextStepState as any)
    )

    const updatedStep = await prisma.batchStep.update({
      where: { id: stepId },
      data: {
        completedQuantity: newTotal,
        status: shouldCompleteStep ? 'COMPLETED' : 'IN_PROGRESS',
      },
    })

    // Unlock next step if current step has progress
    const nextStep = step.batch.steps.find(
      (s: { order: number }) => s.order === step.order + 1
    )

    if (nextStep && nextStep.status === 'LOCKED' && newTotal > 0) {
      await prisma.batchStep.update({
        where: { id: nextStep.id },
        data: {
          status: 'IN_PROGRESS',
        },
      })

      // Notify assigned workers about the unlocked step
      const assignments = await prisma.batchAssignment.findMany({
        where: { batchId: step.batchId },
      })

      assignments.forEach((assignment) => {
        fetch(`${request.nextUrl.origin}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
          body: JSON.stringify({
            workerId: assignment.workerId,
            title: `Your turn: ${step.batch.name}`,
            body: `${nextStep.name} is ready for you`,
            url: `/batches/${step.batchId}`,
          }),
        }).catch((error) => console.error('Failed to send notification:', error))
      })
    }

    // Check if all steps are completed
    // Skip auto-complete for open-ended batches (any step has null targetQuantity)
    const allSteps = await prisma.batchStep.findMany({
      where: { batchId: step.batchId },
    })

    const hasOpenEndedSteps = allSteps.some(
      (s: { targetQuantity: number | null }) => s.targetQuantity == null
    )

    if (!hasOpenEndedSteps) {
      const allCompleted = allSteps.every(
        (s: { id: string; name: string; order: number; type: string; status: string; targetQuantity: number | null; completedQuantity: number; unitRatio: number | null }) => {
          if (isSkippedStep(s)) return true
          const candidate = s.id === stepId
            ? { ...s, completedQuantity: newTotal, status: shouldCompleteStep ? 'COMPLETED' : s.status }
            : s
          return isCountStepComplete(candidate)
        }
      )

      if (allCompleted) {
        await prisma.batch.update({
          where: { id: step.batchId },
          data: {
            status: 'COMPLETED',
            completedDate: new Date(),
          },
        })

        // Notify all assigned workers about batch completion
        const assignments = await prisma.batchAssignment.findMany({
          where: { batchId: step.batchId },
        })

        assignments.forEach((assignment) => {
          fetch(`${request.nextUrl.origin}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
            body: JSON.stringify({
              workerId: assignment.workerId,
              title: `Batch completed: ${step.batch.name}`,
              body: 'All steps have been completed',
              url: `/batches/${step.batchId}`,
            }),
          }).catch((error) => console.error('Failed to send notification:', error))
        })
      }
    }

    return NextResponse.json({
      progressLog,
      step: updatedStep,
    })
  } catch (error) {
    console.error('Log progress error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
