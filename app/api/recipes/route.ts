import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireOwner } from '@/lib/session'

export async function GET() {
  try {
    await requireSession()

    const recipes = await prisma.recipe.findMany({
      include: {
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            batches: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ recipes })
  } catch (error) {
    console.error('Get recipes error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOwner()

    const { name, description, steps } = await request.json()

    if (!name || !steps || steps.length === 0) {
      return NextResponse.json(
        { error: 'Name and steps are required' },
        { status: 400 }
      )
    }

    const recipe = await prisma.recipe.create({
      data: {
        name,
        description,
        steps: {
          create: steps.map((step: { name: string; notes?: string; type?: string }, index: number) => ({
            name: step.name,
            notes: step.notes,
            type: step.type === 'CHECK' ? 'CHECK' : 'COUNT',
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
    console.error('Create recipe error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
