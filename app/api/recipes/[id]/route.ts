import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireSupervisorOrOwner } from '@/lib/auth'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const { id } = await params

    const recipe = await prisma.recipe.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        units: { orderBy: { order: 'asc' } },
        steps: { orderBy: { order: 'asc' }, include: { unit: true, materials: true } },
        products: { where: { archivedAt: null }, orderBy: { name: 'asc' } },
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
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const { name, brand, description, baseUnit, units, steps, products } = await request.json()

    const ownedRecipe = await prisma.recipe.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { id: true },
    })
    if (!ownedRecipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!name || !steps || steps.length === 0) {
      return NextResponse.json({ error: 'Name and steps required' }, { status: 400 })
    }

    const cleanUnits = (units || []).filter((u: { name: string }) => String(u.name || '').trim())
    const cleanSteps = (steps || []).filter((s: { name: string }) => String(s.name || '').trim())
    if (cleanSteps.length === 0) {
      return NextResponse.json({ error: 'Add at least one named step' }, { status: 400 })
    }
    const duplicateUnit = findDuplicate(cleanUnits.map((u: { name: string }) => u.name))
    const duplicateStep = findDuplicate(cleanSteps.map((s: { name: string }) => s.name))
    const cleanProducts = (products || []).map((product: string | { id?: string; name?: string; brand?: string }) => ({
      id: typeof product === 'string' ? undefined : String(product?.id || '') || undefined,
      name: String(typeof product === 'string' ? product : product?.name || '').trim().slice(0, 120),
      brand: String(typeof product === 'string' ? brand || '' : product?.brand || '').trim().slice(0, 100),
    })).filter((product: { name: string }) => product.name)
    const duplicateProduct = findDuplicate(cleanProducts.map((product: { name: string }) => product.name))
    if (duplicateUnit) {
      return NextResponse.json({ error: `Unit names must be unique: ${duplicateUnit}` }, { status: 400 })
    }
    if (duplicateStep) {
      return NextResponse.json({ error: `Step names must be unique: ${duplicateStep}` }, { status: 400 })
    }
    if (duplicateProduct) {
      return NextResponse.json({ error: `Product names must be unique: ${duplicateProduct}` }, { status: 400 })
    }
    if (cleanProducts.some((product: { brand: string }) => !product.brand)) {
      return NextResponse.json({ error: 'Add a brand for each finished product' }, { status: 400 })
    }
    const submittedProductIds = cleanProducts.map((product: { id?: string }) => product.id).filter((productId): productId is string => Boolean(productId))
    if (submittedProductIds.length) {
      const ownedCount = await prisma.product.count({ where: { id: { in: submittedProductIds }, organizationId: session.user.organizationId, archivedAt: null } })
      if (ownedCount !== submittedProductIds.length) return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 })
    }

    const productBrands: string[] = [...new Set<string>(cleanProducts.map((product: { brand: string }) => product.brand))]
    await prisma.brand.createMany({
      data: productBrands.map((brandName) => ({
        name: brandName,
        organizationId: session.user.organizationId,
      })),
      skipDuplicates: true,
    })

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
        brand: null,
        description,
        baseUnit: baseUnit || 'units',
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

    const existingProducts = await prisma.product.findMany({
      where: { recipeId: id, organizationId: session.user.organizationId },
      select: { id: true, name: true, brand: true },
    })
    const wantedProducts = new Map<string, { id?: string; name: string; brand: string }>(cleanProducts.map((product: { id?: string; name: string; brand: string }) => [product.id || product.name.toLowerCase(), product]))
    for (const product of existingProducts) {
      const wanted = wantedProducts.get(product.id) || wantedProducts.get(product.name.toLowerCase())
      await prisma.product.update({
        where: { id: product.id },
        data: { archivedAt: wanted ? null : new Date(), ...(wanted ? { brand: wanted.brand } : {}) },
      })
      wantedProducts.delete(product.id)
      wantedProducts.delete(product.name.toLowerCase())
    }
    const productsToMove = [...wantedProducts.values()].filter((product) => product.id)
    for (const product of productsToMove) {
      await prisma.product.update({ where: { id: product.id }, data: { recipeId: id, brand: product.brand, archivedAt: null } })
    }
    const productsToCreate = [...wantedProducts.values()].filter((product) => !product.id)
    if (productsToCreate.length > 0) {
      await prisma.product.createMany({
        data: productsToCreate.map((product) => ({
          name: product.name,
          brand: product.brand,
          recipeId: id,
          organizationId: session.user.organizationId,
        })),
      })
    }

    // Update/create/delete steps in place to preserve BatchStep foreign keys
    const newStepCount = cleanSteps.length
    const existingStepCount = existingSteps.length

    for (let i = 0; i < newStepCount; i++) {
      const step = cleanSteps[i]
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
        products: { where: { archivedAt: null }, orderBy: { name: 'asc' } },
        _count: { select: { batches: true } },
      },
    })

    return NextResponse.json({ recipe: full })
  } catch (error) {
    console.error('Update recipe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const { action } = await request.json()

    if (action !== 'restore') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const recipe = await prisma.recipe.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        archivedAt: { not: null },
      },
      select: { id: true },
    })

    if (!recipe) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.recipe.update({
      where: { id },
      data: { archivedAt: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Restore recipe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params

    const recipe = await prisma.recipe.findFirst({
      where: { id, organizationId: session.user.organizationId, archivedAt: null },
      select: { id: true },
    })

    if (!recipe) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Preserve recipes referenced by production history, but remove them from
    // recipe pickers. Recipes that were never used can still be hard-deleted.
    const batchCount = await prisma.batch.count({
      where: { recipeId: id },
    })

    if (batchCount > 0) {
      await prisma.recipe.update({
        where: { id },
        data: { archivedAt: new Date() },
      })
      return NextResponse.json({ success: true, archived: true })
    }

    await prisma.recipe.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete recipe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
