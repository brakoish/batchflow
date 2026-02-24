import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'

export async function GET() {
  try {
    await requireOwner()

    const batches = await prisma.batch.findMany({
      where: { status: { in: ['COMPLETED', 'CANCELLED'] } },
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
