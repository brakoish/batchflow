import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id: recipeId } = await params
    const body = await request.json()
    const name = String(body.name || '').trim().slice(0, 120)
    if (!name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 })

    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, organizationId: session.user.organizationId, archivedAt: null },
      select: { id: true },
    })
    if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

    const products = await prisma.product.findMany({
      where: { recipeId, organizationId: session.user.organizationId },
      select: { id: true, name: true, archivedAt: true },
    })
    const existing = products.find((product) => product.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      const product = existing.archivedAt
        ? await prisma.product.update({ where: { id: existing.id }, data: { archivedAt: null }, select: { id: true, name: true } })
        : { id: existing.id, name: existing.name }
      return NextResponse.json({ product, existing: true })
    }

    const product = await prisma.product.create({
      data: { name, recipeId, organizationId: session.user.organizationId },
      select: { id: true, name: true },
    })
    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Supervisor or Owner')) {
      return NextResponse.json({ error: 'Supervisor or owner access required' }, { status: 403 })
    }
    console.error('Create recipe item error:', error)
    return NextResponse.json({ error: 'Unable to add item' }, { status: 500 })
  }
}
