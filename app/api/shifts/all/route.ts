import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'

export async function GET(request: Request) {
  try {
    await requireOwner()

    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get('workerId')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    const where: any = {}
    if (workerId) where.workerId = workerId
    if (dateFrom || dateTo) {
      where.startedAt = {}
      if (dateFrom) where.startedAt.gte = new Date(dateFrom)
      if (dateTo) where.startedAt.lte = new Date(dateTo)
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    })

    // Calculate hours for each shift
    const withHours = shifts.map((s) => ({
      ...s,
      hours: s.endedAt
        ? Math.round(((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000 / 60 / 60) * 100) / 100
        : Math.round(((Date.now() - new Date(s.startedAt).getTime()) / 1000 / 60 / 60) * 100) / 100,
    }))

    return NextResponse.json({ shifts: withHours })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}