import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireOwner } from '@/lib/session'

export async function GET() {
  try {
    const session = await requireSession()

    // Build where clause based on role
    let where: any = { status: 'ACTIVE' }
    
    if (session.role === 'WORKER') {
      // Workers see: batches with no assignments OR batches they're assigned to
      where = {
        status: 'ACTIVE',
        OR: [
          { assignments: { none: {} } },
          { assignments: { some: { workerId: session.id } } },
        ],
      }
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        recipe: true,
        steps: { orderBy: { order: 'asc' } },
        assignments: session.role === 'OWNER' ? { include: { worker: { select: { id: true, name: true } } } } : false,
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
    await requireOwner()

    const { recipeId, name, targetQuantity, startDate, workerIds } = await request.json()

    if (!recipeId || !name || !targetQuantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
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

    const batch = await prisma.batch.create({
      data: {
        recipeId,
        name,
        targetQuantity,
        baseUnit: recipe.baseUnit,
        startDate: startDate ? new Date(startDate) : new Date(),
        assignments: workerIds?.length
          ? { create: workerIds.map((id: string) => ({ workerId: id })) }
          : undefined,
        steps: {
          create: recipe.steps.map((step) => {
            const unitRatio = step.unit?.ratio || 1
            const unitLabel = step.unit?.name || recipe.baseUnit
            const stepTarget = Math.ceil(targetQuantity / unitRatio)

            return {
              recipeStepId: step.id,
              name: step.name,
              order: step.order,
              type: step.type,
              unitLabel,
              unitRatio,
              targetQuantity: stepTarget,
              status: step.order === 1 ? 'IN_PROGRESS' : 'LOCKED',
            }
          }),
        },
      },
      include: {
        recipe: true,
        steps: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Create batch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
