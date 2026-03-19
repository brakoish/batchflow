import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'

export async function GET() {
  try {
    const session = await requireOwner()

    const batches = await prisma.batch.findMany({
      where: {
        status: { in: ['COMPLETED', 'CANCELLED'] },
        organizationId: session.user.organizationId,
      },
      include: {
        recipe: true,
        steps: { orderBy: { order: 'asc' } },
      },
      orderBy: { completedDate: 'desc' },
      take: 50,
    })

    return NextResponse.json({ batches })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
