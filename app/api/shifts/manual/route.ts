import { NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseMissedShift } from '@/lib/missedShift'

export async function POST(request: Request) {
  let session
  try { session = await requireOwner() } catch { return NextResponse.json({ error: 'Owner access required' }, { status: 403 }) }
  let input
  try { input = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const organizationId = session.user.organizationId
  const worker = await prisma.worker.findFirst({ where: { id: typeof input.workerId === 'string' ? input.workerId : '', organizationId }, select: { id: true, organization: { select: { timezone: true } } } })
  if (!worker) return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
  let interval
  try { interval = parseMissedShift(input, worker.organization.timezone) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid shift' }, { status: 400 }) }
  try {
    const shift = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${worker.id}))`
      const overlap = await tx.shift.findFirst({ where: { workerId: worker.id, startedAt: { lt: interval.endedAt }, OR: [{ endedAt: null }, { endedAt: { gt: interval.startedAt } }] } })
      if (overlap) return null
      const created = await tx.shift.create({ data: { workerId: worker.id, ...interval, status: 'COMPLETED' } })
      await tx.shiftCorrectionRequest.create({ data: { shiftId: created.id, workerId: worker.id, requestedStart: interval.startedAt, requestedEnd: interval.endedAt, reason: interval.notes || 'Missed shift added by owner', status: 'APPROVED', reviewedById: session.user.id, reviewedAt: new Date(), reviewNote: 'Created from Add Shift' } })
      return created
    })
    if (!shift) return NextResponse.json({ error: 'This interval overlaps an existing shift' }, { status: 409 })
    return NextResponse.json({ shift }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Unable to add shift. Please try again.' }, { status: 500 }) }
}
