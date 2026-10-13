import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// PATCH — owner/supervisor approves or rejects a correction request
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role === 'WORKER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action, reviewNote } = await req.json()
  if (action !== 'APPROVED' && action !== 'REJECTED') {
    return NextResponse.json({ error: 'action must be APPROVED or REJECTED' }, { status: 400 })
  }

  const correctionReq = await prisma.shiftCorrectionRequest.findFirst({
    where: { id: params.id, worker: { organizationId: session.user.organizationId! } },
    include: { shift: true },
  })

  if (!correctionReq) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${correctionReq.workerId}))`
    const current = await tx.shiftCorrectionRequest.findUniqueOrThrow({ where: { id: params.id } })
    if (current.status !== 'PENDING') return null
    if (action === 'APPROVED') {
      const start = current.requestedStart
      const end = current.requestedEnd
      if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end <= start))) throw new Error('Invalid shift interval')
      const overlap = await tx.shift.findFirst({ where: { workerId: current.workerId, id: { not: current.shiftId }, ...(end ? { startedAt: { lt: end } } : {}), OR: [{ endedAt: null }, { endedAt: { gt: start } }] } })
      if (overlap) throw new Error('Corrected interval overlaps another shift')
    }
    const updatedReq = await tx.shiftCorrectionRequest.update({
      where: { id: params.id },
      data: {
        status: action,
        reviewedById: session.user.id,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
      },
    })

    if (action === 'APPROVED') {
      await tx.shift.update({
        where: { id: correctionReq.shiftId },
        data: {
          startedAt: current.requestedStart,
          endedAt: current.requestedEnd,
          // If they had an open shift and we're setting an end time, mark completed
          status: current.requestedEnd ? 'COMPLETED' : 'ACTIVE',
        },
      })
    }

    return updatedReq
  }).catch((error: Error) => ({ error: error.message }))
  if (!updated) return NextResponse.json({ error: 'Request already reviewed' }, { status: 409 })
  if ('error' in updated) return NextResponse.json(updated, { status: 409 })

  return NextResponse.json({ request: updated })
}
