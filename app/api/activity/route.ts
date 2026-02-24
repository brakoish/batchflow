import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'

export async function GET() {
  try {
    await requireOwner()

    const logs = await prisma.progressLog.findMany({
      take: 50,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
        batchStep: {
          include: {
            batch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Get activity error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
