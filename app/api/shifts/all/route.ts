import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'
import { authErrorResponse } from '@/lib/apiErrors'
import { startOfLocalDay } from '@/lib/timezone'

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
      const nextDay = (day: string) => {
        const date = new Date(`${day}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + 1)
        return date.toISOString().slice(0, 10)
      }
      const parseBound = (value: string, useNextDay: boolean) => {
        if (!isDay(value)) {
          const date = new Date(value)
          return Number.isNaN(date.getTime()) ? null : date
        }
        const check = new Date(`${value}T00:00:00Z`)
        if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== value) return null
        return startOfLocalDay(useNextDay ? nextDay(value) : value, timezone)
      }
      const from = dateFrom ? parseBound(dateFrom, false) : undefined
      const to = dateTo ? parseBound(dateTo, true) : undefined
      if (from === null || to === null) return NextResponse.json({ error: 'Enter a valid date' }, { status: 400 })
      where.startedAt = {}
      if (from) where.startedAt.gte = from
      if (to) {
        if (isDay(dateTo!)) where.startedAt.lt = to
        else where.startedAt.lte = to
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
