import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const body = await request.json()
    const hasArchivedChange = typeof body.archived === 'boolean'
    const hasNameChange = typeof body.name === 'string'
    if (!hasArchivedChange && !hasNameChange) return NextResponse.json({ error: 'Product name or archived status is required' }, { status: 400 })

    const existing = await prisma.product.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { id: true, recipeId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const data: { name?: string; archivedAt?: Date | null } = {}
    if (hasNameChange) {
      const name = body.name.trim().slice(0, 120)
      if (!name) return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
      const duplicate = await prisma.product.findFirst({
        where: {
          id: { not: id },
          recipeId: existing.recipeId,
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      })
      if (duplicate) return NextResponse.json({ error: 'That product name already exists in this recipe' }, { status: 409 })
      data.name = name
    }
    if (hasArchivedChange) data.archivedAt = body.archived ? new Date() : null

    const product = await prisma.product.update({
      where: { id },
      data,
      select: { id: true, name: true, archivedAt: true },
    })
    return NextResponse.json({ product })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Supervisor or owner access required' }, { status: 403 })
  }
}
