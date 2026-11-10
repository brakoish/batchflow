import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'
import { authErrorResponse } from '@/lib/apiErrors'
import { fromDateTimeLocalString } from '@/lib/timezone'

export async function GET(request: Request) {
  try {
    const session = await requireOwner()

    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get('workerId')
    const teamId = searchParams.get('teamId')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')
    const status = searchParams.get('status')

    // Get organization timezone
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { timezone: true },
    })

    const where: any = {
      worker: {
        organizationId: session.user.organizationId,
      },
    }
    if (workerId) where.workerId = workerId
    if (status === 'ACTIVE') where.status = 'ACTIVE'
    if (teamId) {
      const team = await prisma.workTeam.findFirst({ where: { id: teamId, organizationId: session.user.organizationId }, select: { members: { select: { workerId: true } } } })
      if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
      where.workerId = { in: team.members.map(member => member.workerId) }
    }
    if (dateFrom || dateTo) {
      // A plain YYYY-MM-DD means that whole day in the organization's
      // timezone ("To" includes the full day). Full timestamps pass through.
      const timezone = organization?.timezone || 'America/New_York'
      const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
      const dayStart = (day: string) => fromDateTimeLocalString(`${day}T00:00`, timezone)
      const nextDay = (day: string) => {
        const date = new Date(`${day}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + 1)
        return date.toISOString().slice(0, 10)
      }
      where.startedAt = {}
      if (dateFrom) where.startedAt.gte = isDay(dateFrom) ? dayStart(dateFrom) : new Date(dateFrom)
      if (dateTo) {
        if (isDay(dateTo)) where.startedAt.lt = dayStart(nextDay(dateTo))
        else where.startedAt.lte = new Date(dateTo)
      }
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: { worker: { select: { id: true, name: true, hourlyRate: true } } },
      orderBy: { startedAt: 'desc' },
    })

    // Calculate hours for each shift
    const withHours = shifts.map((s) => ({
      ...s,
      hours: s.endedAt
        ? Math.round(((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000 / 60 / 60) * 100) / 100
        : Math.round(((Date.now() - new Date(s.startedAt).getTime()) / 1000 / 60 / 60) * 100) / 100,
    }))

    return NextResponse.json({ shifts: withHours, timezone: organization?.timezone || 'America/New_York' })
  } catch (error) {
    const authError = authErrorResponse(error)
    if (authError) return authError
    console.error('shifts/all failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
