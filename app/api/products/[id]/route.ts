import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const body = await request.json()
    if (typeof body.archived !== 'boolean') return NextResponse.json({ error: 'Archived status is required' }, { status: 400 })
    const existing = await prisma.product.findFirst({ where: { id, organizationId: session.user.organizationId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    const product = await prisma.product.update({ where: { id }, data: { archivedAt: body.archived ? new Date() : null }, select: { id: true, archivedAt: true } })
    return NextResponse.json({ product })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Supervisor or owner access required' }, { status: 403 })
  }
}
