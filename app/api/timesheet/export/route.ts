import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'
import { formatDateInTz, formatTimeInTz, fromDateTimeLocalString } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

function formatDuration(hours: number): string {
  if (hours <= 0) return '0m'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function csvEscape(value: string | number): string {
  return '"' + String(value).replace(/"/g, '""') + '"'
}

function getLocalParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
    day: Number(parts.find((p) => p.type === 'day')?.value),
  }
}

function formatWeekLabel(date: Date, timezone: string): string {
  const { year, month, day } = getLocalParts(date, timezone)
  const localNoon = new Date(Date.UTC(year, month - 1, day, 12))
  const dayOfWeek = localNoon.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(localNoon)
  monday.setUTCDate(localNoon.getUTCDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const start = `${monday.getUTCMonth() + 1}/${monday.getUTCDate()}/${monday.getUTCFullYear()}`
  const end = `${sunday.getUTCMonth() + 1}/${sunday.getUTCDate()}/${sunday.getUTCFullYear()}`
  return `${start} - ${end}`
}

function defaultMonth(timezone: string): string {
  const { year, month } = getLocalParts(new Date(), timezone)
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthRange(month: string, timezone: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1

  return {
    start: fromDateTimeLocalString(`${year}-${String(monthNumber).padStart(2, '0')}-01T00:00`, timezone),
    end: fromDateTimeLocalString(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00`, timezone),
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireOwner()

    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get('workerId')

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { timezone: true },
    })
    const timezone = organization?.timezone || 'America/New_York'
    const requestedMonth = searchParams.get('month')
    const month = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : defaultMonth(timezone)
    const { start, end } = monthRange(month, timezone)

    const shifts = await prisma.shift.findMany({
      where: {
        worker: {
          organizationId: session.user.organizationId,
        },
        ...(workerId ? { workerId } : {}),
        startedAt: {
          gte: start,
          lt: end,
        },
      },
      include: {
        worker: { select: { id: true, name: true } },
      },
      orderBy: [{ startedAt: 'asc' }, { worker: { name: 'asc' } }],
    })

    const logs = await prisma.progressLog.findMany({
      where: {
        ...(workerId ? { workerId } : {}),
        createdAt: {
          gte: start,
          lt: end,
        },
        batchStep: {
          batch: {
            organizationId: session.user.organizationId,
          },
        },
      },
      include: {
        batchStep: {
          select: {
            name: true,
            unitLabel: true,
            batch: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const rows = shifts.map((shift) => {
      const endedAt = shift.endedAt || new Date()
      const shiftLogs = logs.filter((log) => (
        log.workerId === shift.workerId &&
        log.createdAt >= shift.startedAt &&
        log.createdAt <= endedAt
      ))
      const totalUnits = shiftLogs.reduce((sum, log) => sum + log.quantity, 0)
      const rawHours = shift.endedAt
        ? (shift.endedAt.getTime() - shift.startedAt.getTime()) / (1000 * 60 * 60)
        : 0
      const workSummary = shiftLogs.length > 0
        ? shiftLogs.map((log) => {
            const unit = log.batchStep.unitLabel || 'units'
            return `${log.batchStep.batch.name} - ${log.batchStep.name}: ${log.quantity} ${unit}`
          }).join('; ')
        : 'No production logs during shift'

      return {
        Month: month,
        Week: formatWeekLabel(shift.startedAt, timezone),
        Worker: shift.worker.name,
        Date: formatDateInTz(shift.startedAt, timezone),
        'Clock In': formatTimeInTz(shift.startedAt, timezone),
        'Clock Out': shift.endedAt ? formatTimeInTz(shift.endedAt, timezone) : 'Active',
        Hours: shift.endedAt ? formatDuration(rawHours) : 'Active',
        'Total Units': totalUnits,
        'Work Summary': workSummary,
        Notes: shift.notes || '',
      }
    })

    const headers = [
      'Month',
      'Week',
      'Worker',
      'Date',
      'Clock In',
      'Clock Out',
      'Hours',
      'Total Units',
      'Work Summary',
      'Notes',
    ]
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => csvEscape((row as any)[h] ?? '')).join(',')),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="timesheet-${month}-weekly-summary.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Timesheet export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
