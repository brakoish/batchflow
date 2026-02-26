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
    await requireOwner()
    const { id } = await params
    const { name, description, baseUnit, units, steps } = await request.json()

    if (!name || !steps || steps.length === 0) {
      return NextResponse.json({ error: 'Name and steps required' }, { status: 400 })
    }

    // Delete materials first, then steps (they reference units), then units
    await prisma.stepMaterial.deleteMany({
      where: { recipeStep: { recipeId: id } },
    })
    await prisma.recipeStep.deleteMany({ where: { recipeId: id } })
    await prisma.recipeUnit.deleteMany({ where: { recipeId: id } })

    // Update recipe
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

    // Create steps with unit references and materials
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const unitRef = step.unitName
        ? recipe.units.find((u) => u.name === step.unitName)
        : null

      const createdStep = await prisma.recipeStep.create({
        data: {
          recipeId: id,
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
    await requireOwner()
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
