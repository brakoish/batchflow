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

function htmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

function buildCsv(rows: any[], headers: string[]): string {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h] ?? '')).join(',')),
  ].join('\n')
}

function buildFormattedSheet(rows: any[], headers: string[], month: string): string {
  const totalHours = rows.reduce((sum, row) => sum + (row['Hours Decimal'] || 0), 0)
  const totalUnits = rows.reduce((sum, row) => sum + (row['Total Units'] || 0), 0)
  let lastWeek = ''

  const body = rows.map((row) => {
    const isNewWeek = row.Week !== lastWeek
    lastWeek = row.Week

    return `
      <tr class="${isNewWeek ? 'week-start' : ''}">
        ${headers.map((header) => {
          const value = row[header] ?? ''
          const numeric = header === 'Total Units' || header === 'Hours Decimal'
          const wrap = header === 'Work Summary' || header === 'Notes'
          return `<td class="${numeric ? 'number' : ''} ${wrap ? 'wrap' : ''}">${htmlEscape(value)}</td>`
        }).join('')}
      </tr>
    `
  }).join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; vertical-align: top; }
    th { background: #111827; color: #ffffff; font-weight: 700; text-align: left; }
    .title { background: #f3f4f6; font-size: 18px; font-weight: 700; }
    .meta { background: #f9fafb; color: #374151; }
    .week-start td { border-top: 3px solid #2563eb; }
    .number { text-align: right; mso-number-format: "0.00"; }
    .wrap { white-space: normal; width: 360px; }
    .total td { background: #ecfdf5; font-weight: 700; border-top: 2px solid #059669; }
  </style>
</head>
<body>
  <table>
    <tr><td class="title" colspan="${headers.length}">BatchFlow Monthly Timesheet</td></tr>
    <tr><td class="meta" colspan="${headers.length}">Month: ${htmlEscape(month)}</td></tr>
    <tr><td class="meta" colspan="${headers.length}">Grouped by week. Work summaries are matched to logs created during each worker shift.</td></tr>
    <tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join('')}</tr>
    ${body || `<tr><td colspan="${headers.length}">No shifts found for this month.</td></tr>`}
    <tr class="total">
      <td colspan="7">Monthly Total</td>
      <td class="number">${totalHours.toFixed(2)}</td>
      <td class="number">${totalUnits}</td>
      <td colspan="2"></td>
    </tr>
  </table>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireOwner()

    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get('workerId')
    const format = searchParams.get('format')

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
        'Hours Decimal': shift.endedAt ? Math.round(rawHours * 100) / 100 : 0,
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
      'Hours Decimal',
      'Total Units',
      'Work Summary',
      'Notes',
    ]

    if (format === 'sheet') {
      return new NextResponse(buildFormattedSheet(rows, headers, month), {
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="timesheet-${month}-weekly-summary.xls"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    const csv = buildCsv(rows, headers)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="timesheet-${month}-weekly-summary.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Timesheet export error:', error)
    if (error instanceof Error && error.message.includes('Owner access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
