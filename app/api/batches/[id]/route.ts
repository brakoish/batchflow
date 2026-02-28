import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireOwner } from '@/lib/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id } = await params

    const batch = await prisma.batch.findUnique({
      where: { id },
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
    await requireOwner()
    const { id } = await params
    const body = await request.json()
    
    // Handle status-only updates (from batch actions)
    if (body.status && !body.name) {
      const { status } = body
      if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      
      const batch = await prisma.batch.update({
        where: { id },
        data: {
          status,
          completedDate: status === 'COMPLETED' ? new Date() : null,
        },
        include: {
          recipe: true,
          steps: { orderBy: { order: 'asc' } },
        },
      })
      return NextResponse.json({ batch })
    }
    
    // Handle full batch edits
    const { name, targetQuantity, dueDate, workerIds, metrcBatchId, lotNumber, strain, packageTag } = body
    
    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (metrcBatchId !== undefined) updateData.metrcBatchId = metrcBatchId || null
    if (lotNumber !== undefined) updateData.lotNumber = lotNumber || null
    if (strain !== undefined) updateData.strain = strain || null
    if (packageTag !== undefined) updateData.packageTag = packageTag || null
    
    // Handle worker assignment updates
    if (workerIds !== undefined) {
      // Delete existing assignments and create new ones
      await prisma.batchAssignment.deleteMany({ where: { batchId: id } })
      if (workerIds.length > 0) {
        await prisma.batchAssignment.createMany({
          data: workerIds.map((workerId: string) => ({ batchId: id, workerId }))
        })
      }
    }
    
    // Handle target quantity changes (recalculate step targets)
    if (targetQuantity !== undefined) {
      updateData.targetQuantity = targetQuantity
      
      // Get batch with recipe to recalculate steps
      const batch = await prisma.batch.findUnique({
        where: { id },
        include: { recipe: { include: { steps: { include: { unit: true } } } } }
      })
      
      if (batch) {
        // Update each step's target quantity
        for (const recipeStep of batch.recipe.steps) {
          const unitRatio = recipeStep.unit?.ratio || 1
          const stepTarget = Math.ceil(targetQuantity / unitRatio)
          
          await prisma.batchStep.updateMany({
            where: { batchId: id, recipeStepId: recipeStep.id },
            data: { targetQuantity: stepTarget }
          })
        }
      }
    }
    
    const batch = await prisma.batch.update({
      where: { id },
      data: updateData,
      include: {
        recipe: true,
        steps: { orderBy: { order: 'asc' } },
        assignments: { include: { worker: { select: { id: true, name: true } } } },
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
