import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireSupervisorOrOwner } from '@/lib/auth'

const BATCH_OVERRIDE_RECIPE_NAME = '__batchflow_batch_overrides'

function findDuplicate(values: string[]) {
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = value.trim().toLowerCase()
    if (!normalized) continue
    if (seen.has(normalized)) return value.trim()
    seen.add(normalized)
  }
  return null
}

export async function GET() {
  try {
    const session = await requireSession()

    const recipes = await prisma.recipe.findMany({
      where: {
        organizationId: session.user.organizationId,
        name: { not: BATCH_OVERRIDE_RECIPE_NAME },
      },
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
    const session = await requireSupervisorOrOwner()

    const { name, description, baseUnit, units, steps } = await request.json()

    if (!name || !steps || steps.length === 0) {
      return NextResponse.json({ error: 'Name and steps are required' }, { status: 400 })
    }

    const cleanUnits = (units || []).filter((u: { name: string }) => String(u.name || '').trim())
    const cleanSteps = (steps || []).filter((s: { name: string }) => String(s.name || '').trim())
    if (cleanSteps.length === 0) {
      return NextResponse.json({ error: 'Add at least one named step' }, { status: 400 })
    }
    const duplicateUnit = findDuplicate(cleanUnits.map((u: { name: string }) => u.name))
    const duplicateStep = findDuplicate(cleanSteps.map((s: { name: string }) => s.name))
    if (duplicateUnit) {
      return NextResponse.json({ error: `Unit names must be unique: ${duplicateUnit}` }, { status: 400 })
    }
    if (duplicateStep) {
      return NextResponse.json({ error: `Step names must be unique: ${duplicateStep}` }, { status: 400 })
    }

    const recipe = await prisma.recipe.create({
      data: {
        name,
        description,
        baseUnit: baseUnit || 'units',
        organizationId: session.user.organizationId,
        units: {
          create: cleanUnits.map((u: { name: string; ratio: number }, i: number) => ({
            name: String(u.name).trim(),
            ratio: u.ratio || 1,
            order: i,
          })),
        },
      },
      include: { units: true },
    })

    // Create steps with unit references and materials
    for (let i = 0; i < cleanSteps.length; i++) {
      const step = cleanSteps[i]
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
