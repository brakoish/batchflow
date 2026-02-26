import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireOwner } from '@/lib/session'

export async function GET() {
  try {
    await requireSession()

    const recipes = await prisma.recipe.findMany({
      include: {
        units: { orderBy: { order: 'asc' } },
        steps: {
          orderBy: { order: 'asc' },
          include: { unit: true, materials: true },
        },
        _count: { select: { batches: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ recipes })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOwner()

    const { name, description, baseUnit, units, steps } = await request.json()

    if (!name || !steps || steps.length === 0) {
      return NextResponse.json({ error: 'Name and steps are required' }, { status: 400 })
    }

    const recipe = await prisma.recipe.create({
      data: {
        name,
        description,
        baseUnit: baseUnit || 'units',
        units: {
          create: (units || []).map((u: { name: string; ratio: number }, i: number) => ({
            name: u.name,
            ratio: u.ratio || 1,
            order: i,
          })),
        },
      },
      include: { units: true },
    })

    // Create steps with unit references and materials
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const unitRef = step.unitName
        ? recipe.units.find((u) => u.name === step.unitName)
        : null

      const createdStep = await prisma.recipeStep.create({
        data: {
          recipeId: recipe.id,
          name: step.name,
          notes: step.notes || null,
          type: step.type === 'CHECK' ? 'CHECK' : 'COUNT',
          order: i + 1,
          unitId: unitRef?.id || null,
        },
      })

      // Create materials for this step
      if (step.materials && step.materials.length > 0) {
        await prisma.stepMaterial.createMany({
          data: step.materials.map((m: { name: string; quantityPerUnit: number; unit: string }) => ({
            recipeStepId: createdStep.id,
            name: m.name,
            quantityPerUnit: m.quantityPerUnit,
            unit: m.unit || 'units',
          })),
        })
      }
    }

    const full = await prisma.recipe.findUnique({
      where: { id: recipe.id },
      include: {
        units: { orderBy: { order: 'asc' } },
        steps: { orderBy: { order: 'asc' }, include: { unit: true, materials: true } },
      },
    })

    return NextResponse.json({ recipe: full })
  } catch (error) {
    console.error('Create recipe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
