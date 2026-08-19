import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

export async function GET() {
  try {
    const session = await requireSupervisorOrOwner()
    const rows = await prisma.recipe.findMany({
      where: {
        organizationId: session.user.organizationId,
        archivedAt: null,
        brand: { not: null },
      },
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    })

    const brands = rows
      .map((row) => row.brand?.trim())
      .filter((brand): brand is string => Boolean(brand))

    return NextResponse.json(
      { brands },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    )
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
