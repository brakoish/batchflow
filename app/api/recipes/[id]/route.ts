import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireSupervisorOrOwner } from '@/lib/auth'

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
        units: { orderBy: { order: 'asc' } },
        steps: { orderBy: { order: 'asc' }, include: { unit: true, materials: true } },
        _count: { select: { batches: true } },
      },
    })

    if (!recipe) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ recipe })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSupervisorOrOwner()
    const { id } = await params
    const { name, description, baseUnit, units, steps } = await request.json()

    if (!name || !steps || steps.length === 0) {
      return NextResponse.json({ error: 'Name and steps required' }, { status: 400 })
    }

    // Get existing recipe steps (we need to update in place to preserve BatchStep references)
    const existingSteps = await prisma.recipeStep.findMany({
      where: { recipeId: id },
      orderBy: { order: 'asc' },
    })

    // Delete materials (they'll be recreated) — safe because they cascade
    await prisma.stepMaterial.deleteMany({
      where: { recipeStep: { recipeId: id } },
    })

    // Delete old units and recreate
    await prisma.recipeUnit.deleteMany({ where: { recipeId: id } })

    // Update recipe + create new units
    const recipe = await prisma.recipe.update({
      where: { id },
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

    // Update/create/delete steps in place to preserve BatchStep foreign keys
    const newStepCount = steps.length
    const existingStepCount = existingSteps.length

    for (let i = 0; i < newStepCount; i++) {
      const step = steps[i]
      const unitRef = step.unitName
        ? recipe.units.find((u) => u.name === step.unitName)
        : null

      if (i < existingStepCount) {
        // Update existing step in place (preserves BatchStep references)
        await prisma.recipeStep.update({
          where: { id: existingSteps[i].id },
          data: {
            name: step.name,
            notes: step.notes || null,
            type: step.type === 'CHECK' ? 'CHECK' : 'COUNT',
            order: i + 1,
            unitId: unitRef?.id || null,
          },
        })
      } else {
        // Create new step
        await prisma.recipeStep.create({
          data: {
            recipeId: id,
            name: step.name,
            notes: step.notes || null,
            type: step.type === 'CHECK' ? 'CHECK' : 'COUNT',
            order: i + 1,
            unitId: unitRef?.id || null,
          },
        })
      }

      // Recreate materials for this step
      const stepId = i < existingStepCount ? existingSteps[i].id : (await prisma.recipeStep.findFirst({
        where: { recipeId: id, order: i + 1 },
        select: { id: true },
      }))?.id

      if (stepId && step.materials && step.materials.length > 0) {
        await prisma.stepMaterial.createMany({
          data: step.materials.map((m: { name: string; quantityPerUnit: number; unit: string }) => ({
            recipeStepId: stepId,
            name: m.name,
            quantityPerUnit: m.quantityPerUnit,
            unit: m.unit || 'units',
          })),
        })
      }
    }

    // Delete extra steps that were removed (only if no batch steps reference them)
    if (existingStepCount > newStepCount) {
      for (let i = newStepCount; i < existingStepCount; i++) {
        const stepId = existingSteps[i].id
        const batchStepCount = await prisma.batchStep.count({ where: { recipeStepId: stepId } })
        if (batchStepCount === 0) {
          await prisma.recipeStep.delete({ where: { id: stepId } })
        }
        // If batch steps reference it, leave the recipe step (orphaned but safe)
      }
    }

    const full = await prisma.recipe.findUnique({
      where: { id },
      include: {
        units: { orderBy: { order: 'asc' } },
        steps: { orderBy: { order: 'asc' }, include: { unit: true, materials: true } },
        _count: { select: { batches: true } },
      },
    })

    return NextResponse.json({ recipe: full })
  } catch (error) {
    console.error('Update recipe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSupervisorOrOwner()
    const { id } = await params

    // Check if recipe has active batches
    const activeBatches = await prisma.batch.count({
      where: { recipeId: id, status: 'ACTIVE' },
    })

    if (activeBatches > 0) {
      return NextResponse.json(
        { error: 'Cannot delete recipe with active batches' },
        { status: 400 }
      )
    }

    await prisma.recipe.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete recipe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
