import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireOwner } from '@/lib/session'

export async function GET() {
  try {
    await requireSession()

    const batches = await prisma.batch.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        recipe: true,
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    })

    return NextResponse.json({ batches })
  } catch (error) {
    console.error('Get batches error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOwner()

    const { recipeId, name, targetQuantity, startDate } = await request.json()

    if (!recipeId || !name || !targetQuantity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      )
    }

    const batch = await prisma.batch.create({
      data: {
        recipeId,
        name,
        targetQuantity,
        startDate: startDate ? new Date(startDate) : new Date(),
        steps: {
          create: recipe.steps.map((step) => ({
            recipeStepId: step.id,
            name: step.name,
            order: step.order,
            type: step.type,
            targetQuantity,
            status: step.order === 1 ? 'IN_PROGRESS' : 'LOCKED',
          })),
        },
      },
      include: {
        recipe: true,
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Create batch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
