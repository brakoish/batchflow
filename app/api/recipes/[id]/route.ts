import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireSupervisorOrOwner } from '@/lib/auth'
import { normalizeProcessingCategory } from '@/lib/processingCategories'

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
        products: { where: { archivedAt: null }, orderBy: { name: 'asc' }, include: { variations: { where: { archivedAt: null }, orderBy: { name: 'asc' } } } },
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
    const { name, brand, description, baseUnit, category, units, steps, products } = await request.json()

    const ownedRecipe = await prisma.recipe.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { id: true },
    })
    if (!ownedRecipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!name || !steps || steps.length === 0) {
      return NextResponse.json({ error: 'Name and steps required' }, { status: 400 })
    }

    const cleanUnits = (units || []).filter((u: { name: string }) => String(u.name || '').trim())
    const cleanSteps = (steps || []).filter((s: { name: string }) => String(s.name || '').trim()) as Array<{
      id?: string
      name: string
      notes?: string
      type?: string
      unitName?: string
      entryUnit?: string
      materials?: Array<{ name: string; quantityPerUnit: number; unit: string }>
    }>
    const normalizedCategory = normalizeProcessingCategory(category)
    if (cleanSteps.length === 0) {
      return NextResponse.json({ error: 'Add at least one named step' }, { status: 400 })
    }
    if (normalizedCategory === 'FLOWER') {
      const first = cleanSteps[0]
      const last = cleanSteps[cleanSteps.length - 1]
      if (first.type !== 'ENTRY' || String(first.entryUnit || 'g').toLowerCase() !== 'g' || /waste|shake/i.test(first.name)) {
        return NextResponse.json({ error: 'Flower workflows must start with an input weight Entry in grams' }, { status: 400 })
      }
      if (last.type !== 'ENTRY' || String(last.entryUnit || 'g').toLowerCase() !== 'g' || !/waste/i.test(last.name)) {
        return NextResponse.json({ error: 'Flower workflows must end with a waste weight Entry in grams' }, { status: 400 })
      }
    }
    const duplicateUnit = findDuplicate(cleanUnits.map((u: { name: string }) => u.name))
    const duplicateStep = findDuplicate(cleanSteps.map((s: { name: string }) => s.name))
    const cleanProducts = (products || []).map((product: string | { id?: string; name?: string; brand?: string; materialWeightGrams?: number | string | null; variations?: string[] }) => ({
      id: typeof product === 'string' ? undefined : String(product?.id || '') || undefined,
      name: String(typeof product === 'string' ? product : product?.name || '').trim().slice(0, 120),
      brand: String(typeof product === 'string' ? brand || '' : product?.brand || '').trim().slice(0, 100),
      materialWeightGrams: typeof product === 'string' || product.materialWeightGrams == null || product.materialWeightGrams === '' ? null : Number(product.materialWeightGrams),
      variations: typeof product === 'string' ? [] : [...new Map((product.variations || []).map(value => String(value).trim().slice(0, 120)).filter(Boolean).map(value => [value.toLowerCase(), value])).values()],
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
    if (cleanProducts.some((product: { materialWeightGrams: number | null }) => product.materialWeightGrams != null && (!Number.isFinite(product.materialWeightGrams) || product.materialWeightGrams <= 0))) {
      return NextResponse.json({ error: 'Material weight per item must be greater than 0 grams' }, { status: 400 })
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

    // Get existing recipe steps. Submitted stable IDs let us distinguish a
    // deleted middle step from a reorder or rename.
    const existingSteps = await prisma.recipeStep.findMany({
      where: { recipeId: id },
      orderBy: { order: 'asc' },
    })

    const existingById = new Map(existingSteps.map((step) => [step.id, step]))
    const usedStepIds = new Set<string>()
    const resolvedSteps = cleanSteps.map((step, index) => {
      let existingId = step.id && existingById.has(step.id) ? step.id : undefined

      // Backward compatibility for an older cached client that does not send
      // step IDs: match the unchanged name/type first, then fall back to the
      // same position for a rename.
      if (!existingId) {
        const normalizedName = String(step.name).trim().toLowerCase()
        const normalizedType = step.type === 'CHECK' ? 'CHECK' : step.type === 'ENTRY' ? 'ENTRY' : 'COUNT'
        existingId = existingSteps.find((candidate) => (
          !usedStepIds.has(candidate.id)
          && candidate.name.trim().toLowerCase() === normalizedName
          && candidate.type === normalizedType
        ))?.id
      }
      if (!existingId && existingSteps[index] && !usedStepIds.has(existingSteps[index].id)) {
        existingId = existingSteps[index].id
      }
      if (existingId) usedStepIds.add(existingId)
      return { ...step, existingId }
    })

    // Recipe steps referenced by batches are historical identity records and
    // cannot be deleted. Move omitted referenced steps to the hidden internal
    // recipe so they disappear from this reusable recipe while every existing
    // BatchStep keeps its foreign key and history intact.
    const omittedSteps = existingSteps.filter((step) => !usedStepIds.has(step.id))
    if (omittedSteps.length > 0) {
      const referencedCounts = await prisma.batchStep.groupBy({
        by: ['recipeStepId'],
        where: { recipeStepId: { in: omittedSteps.map((step) => step.id) } },
        _count: { _all: true },
      })
      const referencedIds = new Set(referencedCounts.map((row) => row.recipeStepId))
      const referencedSteps = omittedSteps.filter((step) => referencedIds.has(step.id))
      const unreferencedSteps = omittedSteps.filter((step) => !referencedIds.has(step.id))

      if (referencedSteps.length > 0) {
        const overrideRecipe = await prisma.recipe.upsert({
          where: { id: `batch-overrides-${session.user.organizationId}` },
          update: {},
          create: {
            id: `batch-overrides-${session.user.organizationId}`,
            name: BATCH_OVERRIDE_RECIPE_NAME,
            description: 'Internal recipe for batch-specific and retired steps',
            baseUnit: 'units',
            organizationId: session.user.organizationId,
          },
        })
        await prisma.recipeStep.updateMany({
          where: { id: { in: referencedSteps.map((step) => step.id) } },
          data: { recipeId: overrideRecipe.id, unitId: null, order: 0 },
        })
      }
      if (unreferencedSteps.length > 0) {
        await prisma.recipeStep.deleteMany({ where: { id: { in: unreferencedSteps.map((step) => step.id) } } })
      }
    }

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
        category: normalizedCategory,
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
      select: { id: true, name: true, brand: true, materialWeightGrams: true },
    })
    const wantedProducts = new Map<string, { id?: string; name: string; brand: string; materialWeightGrams: number | null; variations: string[] }>(cleanProducts.map((product: { id?: string; name: string; brand: string; materialWeightGrams: number | null; variations: string[] }) => [product.id || product.name.toLowerCase(), product]))
    for (const product of existingProducts) {
      const wanted = wantedProducts.get(product.id) || wantedProducts.get(product.name.toLowerCase())
      await prisma.product.update({
        where: { id: product.id },
        data: { archivedAt: wanted ? null : new Date(), ...(wanted ? { brand: wanted.brand, materialWeightGrams: wanted.materialWeightGrams } : {}) },
      })
      wantedProducts.delete(product.id)
      wantedProducts.delete(product.name.toLowerCase())
    }
    const productsToMove = [...wantedProducts.values()].filter((product) => product.id)
    for (const product of productsToMove) {
      await prisma.product.update({ where: { id: product.id }, data: { recipeId: id, brand: product.brand, materialWeightGrams: product.materialWeightGrams, archivedAt: null } })
    }
    const productsToCreate = [...wantedProducts.values()].filter((product) => !product.id)
    if (productsToCreate.length > 0) {
      await prisma.product.createMany({
        data: productsToCreate.map((product) => ({
          name: product.name,
          brand: product.brand,
          materialWeightGrams: product.materialWeightGrams,
          recipeId: id,
          organizationId: session.user.organizationId,
        })),
      })
    }

    for (const product of cleanProducts) {
      const savedProduct = product.id
        ? await prisma.product.findFirst({ where: { id: product.id, recipeId: id }, select: { id: true } })
        : await prisma.product.findFirst({ where: { recipeId: id, name: product.name }, select: { id: true } })
      if (!savedProduct) continue
      const existingVariations = await prisma.productVariation.findMany({ where: { productId: savedProduct.id }, select: { id: true, name: true } })
      const wantedNames = new Set(product.variations.map(name => name.toLowerCase()))
      for (const variation of existingVariations) {
        await prisma.productVariation.update({ where: { id: variation.id }, data: { archivedAt: wantedNames.has(variation.name.toLowerCase()) ? null : new Date() } })
      }
      for (const variationName of product.variations) {
        const existingVariation = existingVariations.find(variation => variation.name.toLowerCase() === variationName.toLowerCase())
        if (existingVariation) await prisma.productVariation.update({ where: { id: existingVariation.id }, data: { name: variationName, archivedAt: null } })
        else await prisma.productVariation.create({ data: { productId: savedProduct.id, name: variationName } })
      }
    }

    // Update/create/delete steps in place to preserve BatchStep foreign keys
    for (let i = 0; i < resolvedSteps.length; i++) {
      const step = resolvedSteps[i]
      const unitRef = step.unitName
        ? recipe.units.find((u) => u.name === step.unitName)
        : null

      if (step.existingId) {
        // Update existing step in place (preserves BatchStep references)
        await prisma.recipeStep.update({
          where: { id: step.existingId },
          data: {
            name: step.name,
            notes: step.notes || null,
            type: step.type === 'CHECK' ? 'CHECK' : step.type === 'ENTRY' ? 'ENTRY' : 'COUNT',
            entryUnit: step.type === 'ENTRY' ? String(step.entryUnit || 'g').trim().slice(0, 30) || 'g' : null,
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
            type: step.type === 'CHECK' ? 'CHECK' : step.type === 'ENTRY' ? 'ENTRY' : 'COUNT',
            entryUnit: step.type === 'ENTRY' ? String(step.entryUnit || 'g').trim().slice(0, 30) || 'g' : null,
            order: i + 1,
            unitId: unitRef?.id || null,
          },
        })
      }

      // Recreate materials for this step
      const stepId = step.existingId || (await prisma.recipeStep.findFirst({
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

    const full = await prisma.recipe.findUnique({
      where: { id },
      include: {
        units: { orderBy: { order: 'asc' } },
        steps: { orderBy: { order: 'asc' }, include: { unit: true, materials: true } },
        products: { where: { archivedAt: null }, orderBy: { name: 'asc' }, include: { variations: { where: { archivedAt: null }, orderBy: { name: 'asc' } } } },
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
