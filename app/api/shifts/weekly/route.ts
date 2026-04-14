import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await requireOwner()

    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get('workerId')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 })
    }

    // Get organization timezone
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { timezone: true },
    })

    const where: any = {
      worker: {
        organizationId: session.user.organizationId,
      },
      startedAt: {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      },
      status: 'COMPLETED', // Only count completed shifts
    }
    if (workerId) where.workerId = workerId

    const shifts = await prisma.shift.findMany({
      where,
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
    })

    // Collect all unique days in range
    const daySet = new Set<string>()
    shifts.forEach((shift) => {
      daySet.add(shift.startedAt.toISOString().split('T')[0])
    })
    const allDays = Array.from(daySet).sort()

    // Group by worker with per-day breakdown
    const workerMap = new Map<string, {
      workerId: string
      workerName: string
      totalHours: number
      shiftCount: number
      days: Record<string, { hours: number; shiftCount: number }>
    }>()

    shifts.forEach((shift) => {
      if (!shift.endedAt) return // Skip active shifts

      const dayKey = shift.startedAt.toISOString().split('T')[0]
      const hours = Math.round(
        ((new Date(shift.endedAt).getTime() - new Date(shift.startedAt).getTime()) / 1000 / 60 / 60) * 100
      ) / 100

      const existing = workerMap.get(shift.workerId)
      if (existing) {
        existing.totalHours += hours
        existing.shiftCount += 1
        existing.days[dayKey] = existing.days[dayKey]
          ? { hours: existing.days[dayKey].hours + hours, shiftCount: existing.days[dayKey].shiftCount + 1 }
          : { hours, shiftCount: 1 }
      } else {
        workerMap.set(shift.workerId, {
          workerId: shift.workerId,
          workerName: shift.worker.name,
          totalHours: hours,
          shiftCount: 1,
          days: { [dayKey]: { hours, shiftCount: 1 } },
        })
      }
    })

    const weeks = Array.from(workerMap.values()).sort((a, b) => b.totalHours - a.totalHours)

    const totalHours = weeks.reduce((sum, w) => sum + w.totalHours, 0)
    const totalShifts = weeks.reduce((sum, w) => sum + w.shiftCount, 0)

    return NextResponse.json({
      weeks,
      totalHours: Math.round(totalHours * 100) / 100,
      totalShifts,
      timezone: organization?.timezone || 'America/New_York',
      allDays,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
