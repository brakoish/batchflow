import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireOwner, requireSupervisorOrOwner } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const { id } = await params

    const batch = await prisma.batch.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        recipe: true,
        steps: {
          orderBy: {
            order: 'asc',
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
        },
        assignments: { include: { worker: { select: { id: true, name: true } } } },
        removals: {
          include: { worker: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Get batch error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const body = await request.json()

    const existingBatch = await prisma.batch.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    if (!existingBatch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }
    
    // Handle status-only updates (from batch actions)
    if (body.status && !body.name) {
      const { status } = body
      if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }

      // Supervisors can finish production runs, while destructive/lifecycle
      // reversals (cancel and reopen) remain owner-only.
      if (session.user.role === 'SUPERVISOR' && status !== 'COMPLETED') {
        return NextResponse.json({ error: 'Owner access required for this status change' }, { status: 403 })
      }
      
      await prisma.batch.update({
        where: { id },
        data: {
          status,
          completedDate: status === 'COMPLETED' ? new Date() : null,
        },
      })
      const batch = await prisma.batch.findUnique({
        where: { id },
        include: {
          recipe: true,
          steps: {
            orderBy: { order: 'asc' },
            include: {
              recipeStep: {
                select: { notes: true, materials: true },
              },
              progressLogs: {
                include: { worker: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          assignments: { include: { worker: { select: { id: true, name: true } } } },
          removals: {
            include: { worker: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      })
      return NextResponse.json({ batch })
    }
    
    // Handle full batch edits
    const { name, targetQuantity, dueDate, workerIds, metrcBatchId, lotNumber, strain, packageTag, notes, priority } = body

    // Validate priority if provided
    if (priority && !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority value' }, { status: 400 })
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (priority !== undefined) updateData.priority = priority
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (metrcBatchId !== undefined) updateData.metrcBatchId = metrcBatchId || null
    if (lotNumber !== undefined) updateData.lotNumber = lotNumber || null
    if (strain !== undefined) updateData.strain = strain || null
    if (packageTag !== undefined) updateData.packageTag = packageTag || null
    if (notes !== undefined) updateData.notes = notes ? String(notes).slice(0, 2000) : null
    
    if (workerIds !== undefined) {
      if (!Array.isArray(workerIds)) {
        return NextResponse.json({ error: 'Invalid worker assignments' }, { status: 400 })
      }
      const uniqueWorkerIds = [...new Set(workerIds as string[])]
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

    // Recalculate from this batch's step snapshots, never the live recipe.
    const stepUpdates: { id: string; targetQuantity: number | null }[] = []
    if (targetQuantity !== undefined) {
      if (targetQuantity !== null && (!Number.isInteger(targetQuantity) || targetQuantity <= 0)) {
        return NextResponse.json({ error: 'Target must be a whole number greater than 0' }, { status: 400 })
      }
      updateData.targetQuantity = targetQuantity ?? null
      for (const step of existingBatch.steps) {
        let nextTarget: number | null
        if (step.type === 'CHECK') nextTarget = 1
        else if (targetQuantity === null) nextTarget = null
        else if (existingBatch.targetQuantity && step.targetQuantity != null) {
          nextTarget = Math.max(1, Math.ceil((step.targetQuantity * targetQuantity) / existingBatch.targetQuantity))
        } else {
          nextTarget = Math.max(1, Math.ceil(targetQuantity / (step.unitRatio || 1)))
        }
        stepUpdates.push({ id: step.id, targetQuantity: nextTarget })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.batch.update({ where: { id }, data: updateData })
      for (const step of stepUpdates) {
        await tx.batchStep.update({ where: { id: step.id }, data: { targetQuantity: step.targetQuantity } })
      }
      if (workerIds !== undefined) {
        await tx.batchAssignment.deleteMany({ where: { batchId: id } })
        if (workerIds.length) {
          await tx.batchAssignment.createMany({
            data: [...new Set(workerIds as string[])].map((workerId) => ({ batchId: id, workerId })),
          })
        }
      }
    })

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        recipe: true,
        steps: {
          orderBy: { order: 'asc' },
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
        },
        assignments: { include: { worker: { select: { id: true, name: true } } } },
        removals: {
          include: { worker: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Update batch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOwner()
    const { id } = await params

    // Check if batch exists and is cancelled
    const batch = await prisma.batch.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { status: true }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    if (batch.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Only cancelled batches can be deleted' },
        { status: 400 }
      )
    }

    // Delete related records first (cascade)
    await prisma.progressLog.deleteMany({
      where: { batchStep: { batchId: id } }
    })
    await prisma.batchStep.deleteMany({
      where: { batchId: id }
    })
    await prisma.batchAssignment.deleteMany({
      where: { batchId: id }
    })
    await prisma.batch.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete batch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
