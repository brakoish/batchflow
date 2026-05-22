import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

const BATCH_OVERRIDE_RECIPE_NAME = '__batchflow_batch_overrides'

async function getActivityWorkerId(session: Awaited<ReturnType<typeof requireSupervisorOrOwner>>) {
  if (session.user.workerId) return session.user.workerId

  const worker = await prisma.worker.findFirst({
    where: {
      organizationId: session.user.organizationId,
      role: { in: ['OWNER', 'SUPERVISOR'] },
    },
    select: { id: true },
  })

  return worker?.id || null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const body = await request.json()

    const name = String(body.name || '').trim()
    const type = body.type === 'CHECK' ? 'CHECK' : 'COUNT'
    const unitLabel = String(body.unitLabel || 'units').trim() || 'units'
    const targetQuantity = type === 'CHECK'
      ? 1
      : body.targetQuantity == null || body.targetQuantity === ''
      ? null
      : Number(body.targetQuantity)

    if (!name) {
      return NextResponse.json({ error: 'Step name is required' }, { status: 400 })
    }

    if (targetQuantity !== null && (!Number.isInteger(targetQuantity) || targetQuantity <= 0)) {
      return NextResponse.json({ error: 'Target must be a whole number greater than 0' }, { status: 400 })
    }

    const batch = await prisma.batch.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: { steps: { select: { order: true } } },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const nextOrder = Math.max(0, ...batch.steps.map((step) => step.order)) + 1

    const overrideRecipe = await prisma.recipe.upsert({
      where: {
        id: `batch-overrides-${session.user.organizationId}`,
      },
      update: {},
      create: {
        id: `batch-overrides-${session.user.organizationId}`,
        name: BATCH_OVERRIDE_RECIPE_NAME,
        description: 'Internal recipe for batch-specific one-off steps',
        baseUnit: 'units',
        organizationId: session.user.organizationId,
      },
    })

    const recipeStep = await prisma.recipeStep.create({
      data: {
        recipeId: overrideRecipe.id,
        name: name.slice(0, 80),
        order: 0,
        type,
      },
    })

    const step = await prisma.batchStep.create({
      data: {
        batchId: id,
        recipeStepId: recipeStep.id,
        name: name.slice(0, 80),
        order: nextOrder,
        type,
        unitLabel: unitLabel.slice(0, 30),
        unitRatio: 1,
        targetQuantity,
        status: 'IN_PROGRESS',
      },
      include: {
        recipeStep: {
          select: {
            notes: true,
            materials: true,
          },
        },
        progressLogs: {
          include: {
            worker: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    const activityWorkerId = await getActivityWorkerId(session)
    if (activityWorkerId) {
      await prisma.logAudit.create({
        data: {
          batchStepId: step.id,
          workerId: activityWorkerId,
          action: 'step_add',
          newQuantity: targetQuantity,
          newNote: step.name,
        },
      })
    }

    return NextResponse.json({ step })
  } catch (error) {
    console.error('Create batch step error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
