import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'
import { getProducedBaseUnits, getRemovedQuantity } from '@/lib/inventory'

export async function POST(request: NextRequest) {
  try {
    const session = await requireSupervisorOrOwner()
    const body = await request.json()
    const recipeId = String(body.recipeId || '')
    const productId = body.productId ? String(body.productId) : null
    const countedQuantity = Number(body.countedQuantity)
    const note = body.note ? String(body.note).trim().slice(0, 300) : null

    if (!recipeId || !Number.isInteger(countedQuantity) || countedQuantity < 0) {
      return NextResponse.json({ error: 'Enter a whole-number stock count of 0 or more' }, { status: 400 })
    }

    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, organizationId: session.user.organizationId },
      select: { id: true },
    })
    if (!recipe) return NextResponse.json({ error: 'Stock item not found' }, { status: 404 })

    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, recipeId, organizationId: session.user.organizationId },
        select: { id: true },
      })
      if (!product) return NextResponse.json({ error: 'Stock item not found' }, { status: 404 })
    }

    const [batches, adjustments] = await Promise.all([
      prisma.batch.findMany({
        where: {
          organizationId: session.user.organizationId,
          recipeId,
          productId: productId || null,
        },
        select: {
          steps: { select: { name: true, order: true, type: true, completedQuantity: true, unitRatio: true } },
          removals: { select: { quantity: true } },
        },
      }),
      prisma.stockAdjustment.findMany({
        where: {
          organizationId: session.user.organizationId,
          recipeId,
          productId: productId || null,
        },
        select: { quantityDelta: true },
      }),
    ])

    const recordedQuantity = batches.reduce((sum, batch) => (
      sum + Math.max(0, getProducedBaseUnits(batch.steps) - getRemovedQuantity(batch.removals))
    ), 0)
    const adjustmentTotal = adjustments.reduce((sum, adjustment) => sum + adjustment.quantityDelta, 0)
    const previousQuantity = Math.max(0, recordedQuantity + adjustmentTotal)
    const quantityDelta = countedQuantity - previousQuantity

    const adjustment = await prisma.stockAdjustment.create({
      data: {
        organizationId: session.user.organizationId,
        recipeId,
        productId,
        previousQuantity,
        countedQuantity,
        quantityDelta,
        note,
        actorName: session.user.name || session.user.role,
      },
    })

    return NextResponse.json({ adjustment, onHand: countedQuantity }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Supervisor or Owner')) {
      return NextResponse.json({ error: 'Supervisor or owner access required' }, { status: 403 })
    }
    console.error('Create stock count error:', error)
    return NextResponse.json({ error: 'Unable to save stock count' }, { status: 500 })
  }
}
