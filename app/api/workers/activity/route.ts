import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'
import { localDateKey, startOfLocalDay } from '@/lib/timezone'
import { authErrorResponse } from '@/lib/apiErrors'

export async function GET() {
  try {
    const session = await requireOwner()
    const organizationId = session.user.organizationId

    // Today's activity per worker, with "today" starting at midnight in the
    // organization's own timezone.
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    })
    const timezone = organization?.timezone || 'America/New_York'
    const startOfDay = startOfLocalDay(localDateKey(new Date(), timezone), timezone) ?? new Date(new Date().setUTCHours(0, 0, 0, 0))

    const workers = await prisma.worker.findMany({
      where: { role: 'WORKER', organizationId },
      select: {
        id: true,
        name: true,
        shifts: {
          where: { status: 'ACTIVE' },
          select: { startedAt: true },
        },
        progressLogs: {
          where: { createdAt: { gte: startOfDay } },
          select: {
            quantity: true,
            createdAt: true,
            batchStep: {
              select: {
                unitLabel: true,
                batch: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
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
      onShift: w.shifts.length > 0,
      lastActivity: w.progressLogs[0]?.createdAt?.toISOString() || null,
    }))

    return NextResponse.json({ workers: summary })
  } catch (error) {
    const authError = authErrorResponse(error)
    if (authError) return authError
    console.error('workers/activity failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}