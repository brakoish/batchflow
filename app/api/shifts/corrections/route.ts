import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET — owner/supervisor: list pending correction requests for their org
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'PENDING'

  // Only supervisors and owners can see all requests
  if (session.user.role === 'WORKER') {
    // Workers can only see their own
    const requests = await prisma.shiftCorrectionRequest.findMany({
      where: { workerId: session.user.id },
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

  const { shiftId, requestedStart, requestedEnd, reason } = await req.json()

  if (!shiftId || !requestedStart) {
    return NextResponse.json({ error: 'shiftId and requestedStart are required' }, { status: 400 })
  }

  // Verify the shift belongs to this worker
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift || shift.workerId !== session.user.id) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  // Only one pending request per shift at a time
  const existing = await prisma.shiftCorrectionRequest.findFirst({
    where: { shiftId, status: 'PENDING' },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A pending correction request already exists for this shift' },
      { status: 409 }
    )
  }

  const request = await prisma.shiftCorrectionRequest.create({
    data: {
      shiftId,
      workerId: session.user.id,
      requestedStart: new Date(requestedStart),
      requestedEnd: requestedEnd ? new Date(requestedEnd) : null,
      reason: reason || null,
    },
  })

  return NextResponse.json({ request }, { status: 201 })
}
