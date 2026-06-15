import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

const SKIPPED_PREFIX = '[Skipped] '

function isSkippedStep(step: { name: string }) {
  return step.name.startsWith(SKIPPED_PREFIX)
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

    // Find previous step
    const previousStep = [...step.batch.steps]
      .reverse()
      .find((s: { order: number; name: string; type: string }) => s.order < step.order && s.type !== 'CHECK' && !isSkippedStep(s))

    // Calculate ceiling (normalize across different unit ratios)
    const newTotal = step.completedQuantity + quantity

    if (previousStep) {
      // Convert previous step's completed qty to base units, then to this step's units
      const prevBaseUnits = (previousStep as any).completedQuantity * ((previousStep as any).unitRatio || 1)
      const ceiling = Math.floor(prevBaseUnits / ((step as any).unitRatio || 1))

      if (newTotal > ceiling) {
        return NextResponse.json(
          { error: `Only ${Math.max(0, ceiling - step.completedQuantity).toLocaleString()} can be logged right now` },
          { status: 400 }
        )
      }
    } else {
      // First step: ceiling is the step's own target
      // For open-ended batches (targetQuantity is null), skip this check
      if (step.targetQuantity != null && newTotal > step.targetQuantity) {
        return NextResponse.json(
          { error: `Cannot exceed target of ${step.targetQuantity}` },
          { status: 400 }
        )
      }
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
    const updatedStep = await prisma.batchStep.update({
      where: { id: stepId },
      data: {
        completedQuantity: newTotal,
        status: step.targetQuantity != null && newTotal >= step.targetQuantity ? 'COMPLETED' : 'IN_PROGRESS',
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
        include: { worker: true },
      })

      assignments.forEach((assignment) => {
        fetch(`${request.nextUrl.origin}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        (s: { id: string; name: string; targetQuantity: number; completedQuantity: number }) => {
          if (isSkippedStep(s)) return true
          return s.id === stepId
            ? newTotal >= s.targetQuantity
            : s.completedQuantity >= s.targetQuantity
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
          include: { worker: true },
        })

        assignments.forEach((assignment) => {
          fetch(`${request.nextUrl.origin}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
