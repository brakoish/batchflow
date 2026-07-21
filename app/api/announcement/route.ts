import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const announcement = await prisma.announcement.findUnique({
    where: { organizationId: session.organizationId },
    select: { message: true, active: true, updatedAt: true },
  })

  return NextResponse.json(
    { announcement: announcement?.active ? announcement : null },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const active = body?.active !== false

  if (!message) {
    return NextResponse.json({ error: 'Enter an announcement message.' }, { status: 400 })
  }
  if (message.length > 500) {
    return NextResponse.json({ error: 'Announcements must be 500 characters or fewer.' }, { status: 400 })
  }

  const announcement = await prisma.announcement.upsert({
    where: { organizationId: session.organizationId },
    create: { organizationId: session.organizationId, message, active },
    update: { message, active },
    select: { message: true, active: true, updatedAt: true },
  })

  return NextResponse.json({ announcement })
}

export async function DELETE() {
  const session = await getSession()
  if (!session?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.announcement.updateMany({
    where: { organizationId: session.organizationId },
    data: { active: false },
  })

  return NextResponse.json({ success: true })
}
