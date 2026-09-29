import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

const BATCH_OVERRIDE_RECIPE_NAME = '__batchflow_batch_overrides'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const organizationId = session.user.organizationId

    const source = await prisma.recipe.findFirst({
      where: {
        id,
        organizationId,
        archivedAt: null,
        name: { not: BATCH_OVERRIDE_RECIPE_NAME },
      },
      include: {
        units: { orderBy: { order: 'asc' } },
        steps: {
          orderBy: { order: 'asc' },
          include: { materials: true },
        },
      },
    })

    if (!source) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    const baseName = `Copy of ${source.name}`
    const existingCopies = await prisma.recipe.findMany({
      where: { organizationId, name: { startsWith: baseName } },
      select: { name: true },
    })
    const existingNames = new Set(existingCopies.map((recipe) => recipe.name.toLowerCase()))
    let copyName = baseName
    let copyNumber = 2
    while (existingNames.has(copyName.toLowerCase())) {
      copyName = `${baseName} (${copyNumber})`
      copyNumber += 1
    }

    const duplicate = await prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: {
          name: copyName,
          brand: source.brand,
          description: source.description,
          baseUnit: source.baseUnit,
          organizationId,
          units: {
            create: source.units.map((unit) => ({
              name: unit.name,
              ratio: unit.ratio,
              order: unit.order,
            })),
          },
        },
        include: { units: true },
      })

      const copiedUnitsByName = new Map(recipe.units.map((unit) => [unit.name, unit.id]))
      const sourceUnitsById = new Map(source.units.map((unit) => [unit.id, unit.name]))

      for (const step of source.steps) {
        const unitName = step.unitId ? sourceUnitsById.get(step.unitId) : undefined
        await tx.recipeStep.create({
          data: {
            recipeId: recipe.id,
            name: step.name,
            notes: step.notes,
            type: step.type,
            entryUnit: step.entryUnit,
            order: step.order,
            unitId: unitName ? copiedUnitsByName.get(unitName) || null : null,
            materials: {
              create: step.materials.map((material) => ({
                name: material.name,
                quantityPerUnit: material.quantityPerUnit,
                unit: material.unit,
              })),
            },
          },
        })
      }

      return tx.recipe.findUnique({
        where: { id: recipe.id },
        include: {
          units: { orderBy: { order: 'asc' } },
          steps: { orderBy: { order: 'asc' }, include: { unit: true, materials: true } },
          products: { where: { archivedAt: null }, orderBy: { name: 'asc' } },
          _count: { select: { batches: true } },
        },
      })
    })

    return NextResponse.json({ recipe: duplicate }, { status: 201 })
  } catch (error) {
    console.error('Duplicate recipe error:', error)
    return NextResponse.json({ error: 'Failed to duplicate recipe' }, { status: 500 })
  }
}
