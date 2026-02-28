import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await requireOwner()
    
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const workerId = searchParams.get('workerId')
    
    const where: any = {}
    
    if (startDate || endDate) {
      where.startedAt = {}
      if (startDate) where.startedAt.gte = new Date(startDate)
      if (endDate) where.startedAt.lte = new Date(endDate + 'T23:59:59')
    }
    
    if (workerId) {
      where.workerId = workerId
    }
    
    const shifts = await prisma.shift.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
    })
    
    const logWhere: any = {}
    if (startDate || endDate) {
      logWhere.createdAt = {}
      if (startDate) logWhere.createdAt.gte = new Date(startDate)
      if (endDate) logWhere.createdAt.lte = new Date(endDate + 'T23:59:59')
    }
    if (workerId) {
      logWhere.workerId = workerId
    }
    
    const logs = await prisma.progressLog.findMany({
      where: logWhere,
      include: {
        worker: { select: { id: true, name: true } },
        batchStep: { include: { batch: { select: { name: true } } } },
      },
    })
    
    const workerStats: Record<string, { name: string; totalUnits: number; logCount: number }> = {}
    for (const log of logs) {
      if (!workerStats[log.workerId]) {
        workerStats[log.workerId] = { name: log.worker.name, totalUnits: 0, logCount: 0 }
      }
      workerStats[log.workerId].totalUnits += log.quantity
      workerStats[log.workerId].logCount += 1
    }
    
    const rows = shifts.map((shift) => {
      const stats = workerStats[shift.workerId] || { totalUnits: 0, logCount: 0 }
      const hours = shift.endedAt
        ? ((new Date(shift.endedAt).getTime() - new Date(shift.startedAt).getTime()) / (1000 * 60 * 60)).toFixed(2)
        : 'Active'
      
      return {
        Worker: shift.worker.name,
        Date: new Date(shift.startedAt).toLocaleDateString(),
        'Clock In': new Date(shift.startedAt).toLocaleTimeString(),
        'Clock Out': shift.endedAt ? new Date(shift.endedAt).toLocaleTimeString() : 'Active',
        Hours: hours,
        'Units Produced': stats.totalUnits,
        'Log Entries': stats.logCount,
        Notes: shift.notes || '',
      }
    })
    
    const headers = Object.keys(rows[0] || {})
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => '"' + String((row as any)[h]).replace(/"/g, '""') + '"').join(',')
      ),
    ].join('\n')
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="timesheet-' + (startDate || 'all') + '-to-' + (endDate || 'all') + '.csv"',
      },
    })
  } catch (error) {
    console.error('Timesheet export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
