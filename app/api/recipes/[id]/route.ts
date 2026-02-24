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

    const recipe = await prisma.recipe.findUnique({
      where: { id },
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

    return NextResponse.json({ recipe })
  } catch (error) {
    console.error('Get recipe error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params
    const { name, description, steps } = await request.json()

    if (!name || !steps || steps.length === 0) {
      return NextResponse.json(
        { error: 'Name and steps are required' },
        { status: 400 }
      )
    }

    // Delete existing steps and create new ones
    await prisma.recipeStep.deleteMany({
      where: { recipeId: id },
    })

    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        name,
        description,
        steps: {
          create: steps.map((step: { name: string; notes?: string }, index: number) => ({
            name: step.name,
            notes: step.notes,
            order: index + 1,
          })),
        },
      },
      include: {
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    return NextResponse.json({ recipe })
  } catch (error) {
    console.error('Update recipe error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
