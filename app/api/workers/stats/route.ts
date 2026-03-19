import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get worker's stats
    const worker = await prisma.worker.findUnique({
      where: { id: session.user.workerId },
      include: {
        progressLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            batchStep: {
              include: {
                batch: { select: { name: true } }
              }
            }
          }
        },
        shifts: {
          where: { status: 'COMPLETED' },
          orderBy: { startedAt: 'desc' },
          take: 30,
        },
      },
    })

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    // Calculate stats
    const totalUnits = worker.progressLogs.reduce((sum, log) => sum + log.quantity, 0)
    const totalShifts = worker.shifts.length
    const totalHours = worker.shifts.reduce((sum, shift) => {
      if (shift.endedAt) {
        return sum + (new Date(shift.endedAt).getTime() - new Date(shift.startedAt).getTime()) / (1000 * 60 * 60)
      }
      return sum
    }, 0)

    // Units per hour (if has hours logged)
    const unitsPerHour = totalHours > 0 ? Math.round((totalUnits / totalHours) * 10) / 10 : 0

    // Streak calculation (consecutive days with logs)
    const logDates = [...new Set(worker.progressLogs.map(log => 
      new Date(log.createdAt).toDateString()
    ))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    
    let streak = 0
    let currentDate = new Date()
    for (const dateStr of logDates) {
      const logDate = new Date(dateStr)
      const diffDays = Math.floor((currentDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= 1) {
        streak++
        currentDate = logDate
      } else {
        break
      }
    }

    // Recent activity (last 7 days)
    const last7Days = worker.progressLogs.filter(log => 
      new Date(log.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    )

    return NextResponse.json({
      stats: {
        totalUnits,
        totalShifts,
        totalHours: Math.round(totalHours * 10) / 10,
        unitsPerHour,
        streak,
        recentLogs: last7Days.slice(0, 10),
      }
    })
  } catch (error) {
    console.error('Worker stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}