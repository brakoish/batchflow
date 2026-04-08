import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await requireSession()
    const { stepId } = await params
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

    // Steps are never locked — workers can log on any step

    // Find previous step
    const previousStep = step.batch.steps.find(
      (s: { order: number }) => s.order === step.order - 1
    )

    // Calculate ceiling (normalize across different unit ratios)
    const newTotal = step.completedQuantity + quantity
    let warning = ''

    if (previousStep) {
      // Convert previous step's completed qty to base units, then to this step's units
      const prevBaseUnits = (previousStep as any).completedQuantity * ((previousStep as any).unitRatio || 1)
      const ceiling = Math.floor(prevBaseUnits / ((step as any).unitRatio || 1))

      if (newTotal > ceiling) {
        const excess = newTotal - ceiling
        warning = `Exceeds ${(previousStep as any).name} count by ${excess}`
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
        (s: { id: string; targetQuantity: number; completedQuantity: number }) => s.id === stepId
          ? newTotal >= s.targetQuantity
          : s.completedQuantity >= s.targetQuantity
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
      ...(warning && { warning }),
    })
  } catch (error) {
    console.error('Log progress error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
