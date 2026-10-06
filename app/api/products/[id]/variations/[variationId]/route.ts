import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; variationId: string }> }) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id, variationId } = await params
    const body = await request.json()
    if (typeof body.archived !== 'boolean') return NextResponse.json({ error: 'Archived status is required' }, { status: 400 })

    const variation = await prisma.productVariation.findFirst({
      where: { id: variationId, productId: id, product: { organizationId: session.user.organizationId } },
      select: { id: true },
    })
    if (!variation) return NextResponse.json({ error: 'Variation not found' }, { status: 404 })

    const updated = await prisma.productVariation.update({
      where: { id: variationId },
      data: { archivedAt: body.archived ? new Date() : null },
      select: { id: true, name: true, archivedAt: true },
    })
    return NextResponse.json({ variation: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Supervisor or owner access required' }, { status: 403 })
  }
}
