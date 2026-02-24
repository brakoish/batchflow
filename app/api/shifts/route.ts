import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'

// GET current shift for logged-in worker
export async function GET() {
  try {
    const session = await requireSession()

    const activeShift = await prisma.shift.findFirst({
      where: { workerId: session.id, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    })

    const todayShifts = await prisma.shift.findMany({
      where: {
        workerId: session.id,
        startedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      orderBy: { startedAt: 'desc' },
    })

    return NextResponse.json({ activeShift, todayShifts })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// POST clock in
export async function POST() {
  try {
    const session = await requireSession()

    // Check if already clocked in
    const existing = await prisma.shift.findFirst({
      where: { workerId: session.id, status: 'ACTIVE' },
    })

    if (existing) {
      return NextResponse.json({ error: 'Already clocked in' }, { status: 400 })
    }

    const shift = await prisma.shift.create({
      data: { workerId: session.id },
    })

    return NextResponse.json({ shift })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH clock out
export async function PATCH() {
  try {
    const session = await requireSession()

    const activeShift = await prisma.shift.findFirst({
      where: { workerId: session.id, status: 'ACTIVE' },
    })

    if (!activeShift) {
      return NextResponse.json({ error: 'Not clocked in' }, { status: 400 })
    }

    const shift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: { status: 'COMPLETED', endedAt: new Date() },
    })

    return NextResponse.json({ shift })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}