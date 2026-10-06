import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const body = await request.json()
    const name = String(body.name || '').trim().slice(0, 120)
    if (!name) return NextResponse.json({ error: 'Variation name is required' }, { status: 400 })

    const product = await prisma.product.findFirst({
      where: { id, organizationId: session.user.organizationId, archivedAt: null },
      select: { id: true },
    })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const existing = await prisma.productVariation.findFirst({
      where: { productId: id, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    const variation = existing
      ? await prisma.productVariation.update({ where: { id: existing.id }, data: { name, archivedAt: null }, select: { id: true, name: true, archivedAt: true } })
      : await prisma.productVariation.create({ data: { productId: id, name }, select: { id: true, name: true, archivedAt: true } })

    return NextResponse.json({ variation }, { status: existing ? 200 : 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Supervisor or owner access required' }, { status: 403 })
  }
}
