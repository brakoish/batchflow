import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireSupervisorOrOwner } from '@/lib/auth'

export async function GET() {
  try {
    const session = await requireSession()

    const where = {
      status: 'ACTIVE' as const,
      organizationId: session.user.organizationId,
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
        leadWorker: { select: { id: true, name: true } },
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
      leadWorkerId,
      metrcBatchId,
      lotNumber,
      strain,
      packageTag,
      notes,
      priority,
      sourceBatchId,
      materialName,
      materialUnit,
      materialPerBaseUnit,
      materialIssued,
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

    const cleanMaterialName = materialName ? String(materialName).trim().slice(0, 80) : ''
    const cleanMaterialUnit = materialUnit ? String(materialUnit).trim().slice(0, 20) : ''
    const perBaseUnit = materialPerBaseUnit == null || materialPerBaseUnit === '' ? null : Number(materialPerBaseUnit)
    const issuedQuantity = materialIssued == null || materialIssued === '' ? null : Number(materialIssued)
    const tracksMaterial = Boolean(cleanMaterialName || cleanMaterialUnit || perBaseUnit != null || issuedQuantity != null)
    if (tracksMaterial && (!cleanMaterialName || !cleanMaterialUnit || !Number.isFinite(perBaseUnit) || perBaseUnit! <= 0 || !Number.isFinite(issuedQuantity) || issuedQuantity! <= 0)) {
      return NextResponse.json({ error: 'Enter the material, weight issued, unit, and amount used per finished unit' }, { status: 400 })
    }

    if (sourceBatchId && !sourceBatch) {
      return NextResponse.json({ error: 'Source batch not found' }, { status: 404 })
    }

    const selectedProductId = productId || sourceBatch?.productId || null
    const activeProducts = await prisma.product.findMany({
      where: { recipeId, organizationId: session.user.organizationId, archivedAt: null },
      select: { id: true, unitsPerCase: true },
    })
    if (activeProducts.length > 0 && !activeProducts.some(product => product.id === selectedProductId)) {
      return NextResponse.json({ error: 'Select a finished product' }, { status: 400 })
    }
    if (selectedProductId && activeProducts.length === 0) {
      return NextResponse.json({ error: 'Product not found for this recipe' }, { status: 400 })
    }
    const selectedProduct = activeProducts.find(product => product.id === selectedProductId) || null
    const applyItemCaseSize = <T extends { type: string; unitLabel: string; unitRatio: number; targetQuantity: number | null }>(step: T): T => {
      if (!selectedProduct?.unitsPerCase || step.type !== 'COUNT' || !/^cases?$/i.test(step.unitLabel.trim())) return step
      return {
        ...step,
        unitRatio: selectedProduct.unitsPerCase,
        targetQuantity: nextBatchTarget == null ? null : Math.max(1, Math.ceil(nextBatchTarget / selectedProduct.unitsPerCase)),
      }
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
    if (leadWorkerId && !uniqueWorkerIds.includes(String(leadWorkerId))) {
      return NextResponse.json({ error: 'Team lead must be assigned to this batch' }, { status: 400 })
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
      ? sourceBatch.steps.map((step) => applyItemCaseSize({
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

          return applyItemCaseSize({
            recipeStepId: step.id,
            name: step.name,
            order: step.order,
            type: step.type,
            unitLabel,
            unitRatio,
            targetQuantity: stepTarget,
            status: 'IN_PROGRESS' as const,
          })
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
        leadWorkerId: leadWorkerId ? String(leadWorkerId) : null,
        startDate: startDate ? new Date(startDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        metrcBatchId: metrcBatchId || undefined,
        lotNumber: lotNumber || undefined,
        strain: strain || undefined,
        packageTag: packageTag || undefined,
        notes: notes ? String(notes).slice(0, 2000) : undefined,
        materialName: tracksMaterial ? cleanMaterialName : undefined,
        materialUnit: tracksMaterial ? cleanMaterialUnit : undefined,
        materialRatio: tracksMaterial ? 1 / perBaseUnit! : undefined,
        materialEvents: tracksMaterial && issuedQuantity
          ? { create: { workerId: session.user.workerId || null, actorName: session.user.name || session.user.role, type: 'ISSUE', quantity: issuedQuantity } }
          : undefined,
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
        leadWorker: { select: { id: true, name: true } },
        steps: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Create batch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
