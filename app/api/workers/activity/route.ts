import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'

export async function GET() {
  try {
    await requireOwner()

    // Today's activity per worker
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const workers = await prisma.worker.findMany({
      where: { role: 'WORKER' },
      select: {
        id: true,
        name: true,
        progressLogs: {
          where: { createdAt: { gte: startOfDay } },
          select: {
            quantity: true,
            batchStep: {
              select: {
                unitLabel: true,
                batch: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const summary = workers.map((w) => ({
      id: w.id,
      name: w.name,
      todayLogs: w.progressLogs.length,
      todayUnits: w.progressLogs.reduce((sum, l) => sum + l.quantity, 0),
      batches: Array.from(new Set(w.progressLogs.map(l => l.batchStep.batch.name))),
    }))

    return NextResponse.json({ workers: summary })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
