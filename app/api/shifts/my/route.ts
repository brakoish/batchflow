import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

// Worker-safe timesheet feed. Scoped to the current session's worker id,
// so PIN-authenticated workers can see their own shifts without needing
// OWNER role. Never trusts a workerId from the query string.
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    const workerId = session.user.workerId || session.user.id
    if (!workerId) {
      return NextResponse.json({ error: 'No worker bound to session' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    // Get organization timezone
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { timezone: true },
    })

    const where: any = {
      workerId,
      worker: { organizationId: session.user.organizationId },
    }
    if (dateFrom || dateTo) {
      where.startedAt = {}
      if (dateFrom) where.startedAt.gte = new Date(dateFrom)
      if (dateTo) where.startedAt.lte = new Date(dateTo)
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 200,
    })

    const withHours = shifts.map((s) => ({
      id: s.id,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      hours: s.endedAt
        ? Math.round(((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000 / 60 / 60) * 100) / 100
        : Math.round(((Date.now() - new Date(s.startedAt).getTime()) / 1000 / 60 / 60) * 100) / 100,
    }))

    const totalHours = withHours
      .filter((s) => s.endedAt) // only completed shifts count toward the total
      .reduce((sum, s) => sum + s.hours, 0)

    return NextResponse.json({
      shifts: withHours,
      totalHours: Math.round(totalHours * 100) / 100,
      timezone: organization?.timezone || 'America/New_York',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
