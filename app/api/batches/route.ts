import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireSupervisorOrOwner } from '@/lib/auth'

export async function GET() {
  try {
    const session = await requireSession()

    // Build where clause based on role
    let where: any = {
      status: 'ACTIVE',
      organizationId: session.user.organizationId,
    }

    if (session.user.role === 'WORKER' && session.user.workerId) {
      // Workers see: batches with no assignments OR batches they're assigned to
      where = {
        status: 'ACTIVE',
        organizationId: session.user.organizationId,
        OR: [
          { assignments: { none: {} } },
          { assignments: { some: { workerId: session.user.workerId } } },
        ],
      }
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        recipe: true,
        product: true,
        steps: {
          orderBy: { order: 'asc' },
          include: {
            progressLogs: {
              take: 3,
              orderBy: { createdAt: 'desc' },
              include: { worker: { select: { id: true, name: true } } },
            },
          },
        },
        assignments: { include: { worker: { select: { id: true, name: true } } } },
      },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({ batches })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSupervisorOrOwner()

    const {
      recipeId,
      productId,
      name,
      targetQuantity,
      startDate,
      dueDate,
      workerIds,
      metrcBatchId,
      lotNumber,
      strain,
      packageTag,
      notes,
      priority,
      sourceBatchId,
    } = await request.json()

    if (!recipeId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate priority if provided
    if (priority && !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority value' }, { status: 400 })
    }

    const recipe = await prisma.recipe.findUnique({
      where: {
        id: recipeId,
        organizationId: session.user.organizationId,
      },
      include: {
        units: true,
        steps: {
          orderBy: { order: 'asc' },
          include: { unit: true },
        },
      },
    })

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    const sourceBatch = sourceBatchId
      ? await prisma.batch.findFirst({
          where: {
            id: sourceBatchId,
            recipeId,
            organizationId: session.user.organizationId,
          },
          include: {
            steps: { orderBy: { order: 'asc' } },
          },
        })
      : null

    if (sourceBatchId && !sourceBatch) {
      return NextResponse.json({ error: 'Source batch not found' }, { status: 404 })
    }

    const selectedProductId = productId || sourceBatch?.productId || null
    const activeProducts = await prisma.product.findMany({
      where: { recipeId, organizationId: session.user.organizationId, archivedAt: null },
      select: { id: true },
    })
    if (activeProducts.length > 0 && !activeProducts.some(product => product.id === selectedProductId)) {
      return NextResponse.json({ error: 'Select a finished product' }, { status: 400 })
    }
    if (selectedProductId && activeProducts.length === 0) {
      return NextResponse.json({ error: 'Product not found for this recipe' }, { status: 400 })
    }


    const uniqueWorkerIds = Array.isArray(workerIds) ? [...new Set(workerIds as string[])] : []
    if (workerIds !== undefined && !Array.isArray(workerIds)) {
      return NextResponse.json({ error: 'Invalid worker assignments' }, { status: 400 })
    }
    if (uniqueWorkerIds.length) {
      const validWorkers = await prisma.worker.count({
        where: {
          id: { in: uniqueWorkerIds },
          organizationId: session.user.organizationId,
          role: { in: ['WORKER', 'SUPERVISOR'] },
        },
      })
      if (validWorkers !== uniqueWorkerIds.length) {
        return NextResponse.json({ error: 'One or more workers are invalid' }, { status: 400 })
      }
    }

    const nextBatchTarget = targetQuantity ?? null
    const buildClonedStepTarget = (step: NonNullable<typeof sourceBatch>['steps'][number]) => {
      if (step.type === 'CHECK') return 1
      if (nextBatchTarget == null) return null

      if (sourceBatch?.targetQuantity && step.targetQuantity != null) {
        return Math.max(1, Math.ceil((step.targetQuantity * nextBatchTarget) / sourceBatch.targetQuantity))
      }

      if (step.unitRatio > 0) {
        return Math.max(1, Math.ceil(nextBatchTarget / step.unitRatio))
      }

      return step.targetQuantity
    }

    const batchSteps = sourceBatch
      ? sourceBatch.steps.map((step) => ({
          recipeStepId: step.recipeStepId,
          name: step.name,
          order: step.order,
          type: step.type,
          unitLabel: step.unitLabel,
          unitRatio: step.unitRatio,
          targetQuantity: buildClonedStepTarget(step),
          completedQuantity: 0,
          status: step.name.startsWith('[Skipped] ') ? 'COMPLETED' as const : 'IN_PROGRESS' as const,
        }))
      : recipe.steps.map((step) => {
          const unitRatio = step.unit?.ratio || 1
          const unitLabel = step.unit?.name || recipe.baseUnit

          // For open-ended batches (no targetQuantity), set step targets to null
          // Except for CHECK steps which always have target of 1
          let stepTarget: number | null
          if (step.type === 'CHECK') {
            stepTarget = 1
          } else if (targetQuantity == null) {
            stepTarget = null
          } else {
            stepTarget = Math.ceil(targetQuantity / unitRatio)
          }

          return {
            recipeStepId: step.id,
            name: step.name,
            order: step.order,
            type: step.type,
            unitLabel,
            unitRatio,
            targetQuantity: stepTarget,
            status: 'IN_PROGRESS' as const,
          }
        })

    const batch = await prisma.batch.create({
      data: {
        recipeId,
        productId: selectedProductId,
        name,
        targetQuantity: targetQuantity ?? null,
        baseUnit: recipe.baseUnit,
        priority: priority || 'NORMAL',
        organizationId: session.user.organizationId,
        startDate: startDate ? new Date(startDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        metrcBatchId: metrcBatchId || undefined,
        lotNumber: lotNumber || undefined,
        strain: strain || undefined,
        packageTag: packageTag || undefined,
        notes: notes ? String(notes).slice(0, 2000) : undefined,
        assignments: uniqueWorkerIds.length
          ? { create: uniqueWorkerIds.map((workerId) => ({ workerId })) }
          : undefined,
        steps: {
          create: batchSteps,
        },
      },
      include: {
        recipe: true,
        product: true,
        steps: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Create batch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
