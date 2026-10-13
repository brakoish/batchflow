import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET — owner/supervisor: list pending correction requests for their org
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.user.workerId) return NextResponse.json({ error: 'No worker bound to session' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'PENDING'

  // Only supervisors and owners can see all requests
  if (session.user.role === 'WORKER') {
    // Workers can only see their own
    const requests = await prisma.shiftCorrectionRequest.findMany({
      where: { workerId: session.user.workerId },
      include: {
        shift: true,
        worker: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ requests })
  }

  const requests = await prisma.shiftCorrectionRequest.findMany({
    where: {
      worker: { organizationId: session.user.organizationId! },
      ...(status !== 'ALL' ? { status: status as any } : {}),
    },
    include: {
      shift: true,
      worker: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ requests })
}

// POST — worker submits a correction request
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.user.workerId) return NextResponse.json({ error: 'No worker bound to session' }, { status: 400 })

  const { shiftId, requestedStart, requestedEnd, reason } = await req.json()

  if (!shiftId || !requestedStart) {
    return NextResponse.json({ error: 'shiftId and requestedStart are required' }, { status: 400 })
  }

  const start = new Date(requestedStart)
  const end = requestedEnd ? new Date(requestedEnd) : null
  if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end <= start))) return NextResponse.json({ error: 'Invalid shift interval' }, { status: 400 })
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.user.workerId}))`
  // Verify the shift belongs to this worker
  const shift = await tx.shift.findUnique({ where: { id: shiftId } })
  if (!shift || shift.workerId !== session.user.workerId) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const overlap = await tx.shift.findFirst({ where: { workerId: shift.workerId, id: { not: shift.id }, ...(end ? { startedAt: { lt: end } } : {}), OR: [{ endedAt: null }, { endedAt: { gt: start } }] } })
  if (overlap) return NextResponse.json({ error: 'Requested interval overlaps another shift' }, { status: 409 })

  // Only one pending request per shift at a time
  const existing = await tx.shiftCorrectionRequest.findFirst({
    where: { shiftId, status: 'PENDING' },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A pending correction request already exists for this shift' },
      { status: 409 }
    )
  }

  const request = await tx.shiftCorrectionRequest.create({
    data: {
      shiftId,
      workerId: session.user.workerId,
      requestedStart: start,
      requestedEnd: end,
      reason: reason || null,
    },
  })

  return NextResponse.json({ request }, { status: 201 })
  })
}
