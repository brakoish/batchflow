import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOwner()
    const { id } = await params
    const { startedAt, endedAt } = await request.json()

    const ownedShift = await prisma.shift.findFirst({
      where: { id, worker: { organizationId: session.user.organizationId } },
      select: { id: true, workerId: true },
    })
    if (!ownedShift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

    // Validate dates
    const start = new Date(startedAt)
    const end = endedAt ? new Date(endedAt) : null

    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid start time' }, { status: 400 })
    }

    if (end && isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid end time' }, { status: 400 })
    }

    if (end && end <= start) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownedShift.workerId}))`
      const previous = await tx.shift.findUniqueOrThrow({ where: { id } })
      const overlap = await tx.shift.findFirst({ where: { workerId: previous.workerId, id: { not: id }, ...(end ? { startedAt: { lt: end } } : {}), OR: [{ endedAt: null }, { endedAt: { gt: start } }] } })
      if (overlap) return null
      await tx.shiftCorrectionRequest.create({ data: {
        shiftId: id, workerId: previous.workerId, requestedStart: start, requestedEnd: end,
        reason: `Owner edit; previous interval ${previous.startedAt.toISOString()} to ${previous.endedAt?.toISOString() || 'open'}`,
        status: 'APPROVED', reviewedById: session.user.id, reviewedAt: new Date(), reviewNote: 'Applied from owner shift editor',
      } })
      return tx.shift.update({ where: { id }, data: { startedAt: start, endedAt: end, status: end ? 'COMPLETED' : 'ACTIVE' }, include: { worker: { select: { id: true, name: true } } } })
    })
    if (!result) return NextResponse.json({ error: 'This interval overlaps another shift' }, { status: 409 })
    const hours = Math.round(((result.endedAt?.getTime() || Date.now()) - result.startedAt.getTime()) / 3600000 * 100) / 100
    return NextResponse.json({ shift: { ...result, hours } })
  } catch (error) {
    console.error('Update shift error:', error)
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOwner()
    const { id } = await params

    const ownedShift = await prisma.shift.findFirst({
      where: { id, worker: { organizationId: session.user.organizationId } },
      select: { id: true },
    })
    if (!ownedShift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

    return NextResponse.json({ error: 'Payroll history cannot be deleted; archival requires a retention-capable schema.' }, { status: 409 })
  } catch (error) {
    console.error('Delete shift error:', error)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}
