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

  const correctionReq = await prisma.shiftCorrectionRequest.findUnique({
    where: { id: params.id },
    include: { shift: true },
  })

  if (!correctionReq) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (correctionReq.status !== 'PENDING') {
    return NextResponse.json({ error: 'Request already reviewed' }, { status: 409 })
  }

  // Run in a transaction: update the request + apply shift change if approved
  const updated = await prisma.$transaction(async (tx) => {
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
          startedAt: correctionReq.requestedStart,
          endedAt: correctionReq.requestedEnd ?? undefined,
          // If they had an open shift and we're setting an end time, mark completed
          ...(correctionReq.requestedEnd ? { status: 'COMPLETED' } : {}),
        },
      })
    }

    return updatedReq
  })

  return NextResponse.json({ request: updated })
}
