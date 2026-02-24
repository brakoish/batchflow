import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'

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

    if (step.status === 'LOCKED') {
      return NextResponse.json(
        { error: 'Step is locked' },
        { status: 400 }
      )
    }

    // Find previous step
    const previousStep = step.batch.steps.find(
      (s: { order: number }) => s.order === step.order - 1
    )

    // Calculate ceiling
    let ceiling = step.batch.targetQuantity
    if (previousStep) {
      ceiling = previousStep.completedQuantity
    }

    // Validate ceiling rule
    const newTotal = step.completedQuantity + quantity
    if (newTotal > ceiling) {
      return NextResponse.json(
        {
          error: `Cannot exceed ceiling of ${ceiling}. Current: ${step.completedQuantity}, Attempting to add: ${quantity}`,
        },
        { status: 400 }
      )
    }

    // Create progress log
    const progressLog = await prisma.progressLog.create({
      data: {
        batchStepId: stepId,
        workerId: session.id,
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

    // Update step completed quantity and status
    const updatedStep = await prisma.batchStep.update({
      where: { id: stepId },
      data: {
        completedQuantity: newTotal,
        status: newTotal >= step.targetQuantity ? 'COMPLETED' : 'IN_PROGRESS',
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
    }

    // Check if all steps are completed
    const allSteps = await prisma.batchStep.findMany({
      where: { batchId: step.batchId },
    })

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
