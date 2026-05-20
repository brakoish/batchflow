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

function xmlEscape(value: string | number): string {
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
  const summaryHeaders = ['Worker', 'Week', 'Shifts', 'Hours', 'Total Units', 'Batches / Steps Worked', 'Notes']
  const workerWeekMap = new Map<string, any>()

  for (const row of rows) {
    const key = `${row.Worker}__${row.Week}`
    const existing = workerWeekMap.get(key) || {
      Worker: row.Worker,
      Week: row.Week,
      Shifts: 0,
      Hours: 0,
      'Total Units': 0,
      'Batches / Steps Worked': new Set<string>(),
      Notes: new Set<string>(),
    }

    existing.Shifts += 1
    existing.Hours += row['Hours Decimal'] || 0
    existing['Total Units'] += row['Total Units'] || 0
    if (row['Work Summary'] && row['Work Summary'] !== 'No production logs during shift') {
      row['Work Summary'].split('; ').forEach((item: string) => existing['Batches / Steps Worked'].add(item))
    }
    if (row.Notes) existing.Notes.add(row.Notes)
    workerWeekMap.set(key, existing)
  }

  const summaryRows = Array.from(workerWeekMap.values())
    .sort((a, b) => a.Worker.localeCompare(b.Worker) || a.Week.localeCompare(b.Week))
    .map((row) => ({
      ...row,
      Hours: Math.round(row.Hours * 100) / 100,
      'Batches / Steps Worked': Array.from(row['Batches / Steps Worked']).join('; ') || 'No production logs during shifts',
      Notes: Array.from(row.Notes).join('; '),
    }))

  const columnWidths: Record<string, number> = {
    Month: 70,
    Week: 135,
    Worker: 135,
    Date: 80,
    'Clock In': 80,
    'Clock Out': 80,
    Hours: 75,
    'Hours Decimal': 90,
    'Total Units': 80,
    'Work Summary': 300,
    Notes: 180,
    Shifts: 60,
    'Batches / Steps Worked': 360,
  }

  const cell = (value: string | number, style = 'Cell') => {
    const type = typeof value === 'number' ? 'Number' : 'String'
    return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`
  }

  const rowXml = (values: (string | number)[], style = 'Cell') => (
    `<Row>${values.map((value) => cell(value, style)).join('')}</Row>`
  )

  const worksheet = (name: string, sheetHeaders: string[], sheetRows: any[], totalRow?: (string | number)[]) => `
    <Worksheet ss:Name="${xmlEscape(name)}">
      <Table>
        ${sheetHeaders.map((header) => `<Column ss:Width="${columnWidths[header] || 100}" />`).join('')}
        <Row><Cell ss:MergeAcross="${sheetHeaders.length - 1}" ss:StyleID="Title"><Data ss:Type="String">BatchFlow Monthly Timesheet</Data></Cell></Row>
        <Row><Cell ss:MergeAcross="${sheetHeaders.length - 1}" ss:StyleID="Meta"><Data ss:Type="String">Month: ${xmlEscape(month)}</Data></Cell></Row>
        <Row><Cell ss:MergeAcross="${sheetHeaders.length - 1}" ss:StyleID="Meta"><Data ss:Type="String">${name === 'Worker Summary' ? 'Per-worker monthly view grouped by week.' : 'Shift-level detail grouped by week.'}</Data></Cell></Row>
        ${rowXml(sheetHeaders, 'Header')}
        ${sheetRows.map((row) => rowXml(sheetHeaders.map((header) => row[header] ?? ''), 'Cell')).join('')}
        ${totalRow ? rowXml(totalRow, 'Total') : ''}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>4</SplitHorizontal>
        <TopRowBottomPane>4</TopRowBottomPane>
        <ActivePane>2</ActivePane>
      </WorksheetOptions>
    </Worksheet>
  `

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Cell">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
      </Borders>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Size="16" ss:Bold="1"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Meta">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#374151"/>
      <Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#111827" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="Total">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
      <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${worksheet('Weekly Detail', headers, rows, ['Monthly Total', '', '', '', '', '', '', totalHours.toFixed(2), totalUnits, '', ''])}
  ${worksheet('Worker Summary', summaryHeaders, summaryRows, ['Monthly Total', '', rows.length, totalHours.toFixed(2), totalUnits, '', ''])}
</Workbook>`
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
