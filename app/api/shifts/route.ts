import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { localDateKey, fromDateTimeLocalString } from '@/lib/timezone'

// GET current shift for logged-in worker
export async function GET() {
  try {
    const session = await requireSession()
    if (!session.user.workerId) return NextResponse.json({ error: 'No worker bound to session' }, { status: 400 })

    const worker = await prisma.worker.findUnique({
      where: { id: session.user.workerId },
      include: { organization: { select: { timezone: true } } },
    })

    const activeShift = await prisma.shift.findFirst({
      where: { workerId: session.user.workerId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    })

    const todayShifts = await prisma.shift.findMany({
      where: {
        workerId: session.user.workerId,
        startedAt: { gte: fromDateTimeLocalString(`${localDateKey(new Date(), worker?.organization?.timezone || 'America/New_York')}T00:00`, worker?.organization?.timezone || 'America/New_York') },
      },
      orderBy: { startedAt: 'desc' },
    })

    return NextResponse.json({
      activeShift,
      todayShifts,
      timezone: worker?.organization?.timezone || 'America/New_York'
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// POST clock in
export async function POST() {
  try {
    const session = await requireSession()
    if (!session.user.workerId) return NextResponse.json({ error: 'No worker bound to session' }, { status: 400 })

    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.user.workerId}))`
    // Check if already clocked in
    const existing = await tx.shift.findFirst({
      where: { workerId: session.user.workerId, status: 'ACTIVE' },
    })

    if (existing) {
      return NextResponse.json({ error: 'Already clocked in' }, { status: 400 })
    }

    const latest = await tx.shift.findFirst({ where: { workerId: session.user.workerId }, orderBy: { startedAt: 'desc' } })
    if (latest?.endedAt && latest.endedAt > new Date()) return NextResponse.json({ error: 'Clock-in overlaps an existing shift' }, { status: 409 })
    const shift = await tx.shift.create({
      data: { workerId: session.user.workerId },
    })

    return NextResponse.json({ shift })
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH clock out
export async function PATCH() {
  try {
    const session = await requireSession()
    if (!session.user.workerId) return NextResponse.json({ error: 'No worker bound to session' }, { status: 400 })

    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.user.workerId}))`
    const activeShift = await tx.shift.findFirst({
      where: { workerId: session.user.workerId, status: 'ACTIVE' },
    })

    if (!activeShift) {
      return NextResponse.json({ error: 'Not clocked in' }, { status: 400 })
    }

    if (activeShift.startedAt >= new Date()) return NextResponse.json({ error: 'Clock-out must be after clock-in' }, { status: 409 })
    const shift = await tx.shift.update({
      where: { id: activeShift.id },
      data: { status: 'COMPLETED', endedAt: new Date() },
    })

    return NextResponse.json({ shift })
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}