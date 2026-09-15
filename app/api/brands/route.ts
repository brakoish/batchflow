import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

export async function GET() {
  try {
    const session = await requireSupervisorOrOwner()
    const rows = await prisma.brand.findMany({
      where: { organizationId: session.user.organizationId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const brands = rows.map((row) => row.name)

    return NextResponse.json(
      { brands },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    )
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSupervisorOrOwner()
    const body = await request.json()
    const name = String(body.name || '').trim().slice(0, 100)
    if (!name) return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
    const existing = await prisma.brand.findFirst({
      where: { organizationId: session.user.organizationId, name: { equals: name, mode: 'insensitive' } },
    })
    const brand = existing
      ? await prisma.brand.update({ where: { id: existing.id }, data: { archivedAt: null } })
      : await prisma.brand.create({ data: { name, organizationId: session.user.organizationId } })
    return NextResponse.json({ brand }, { status: existing ? 200 : 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
