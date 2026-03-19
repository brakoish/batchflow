import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { slug, pin } = await request.json()

    if (!slug || !pin || pin.length !== 4) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Find organization
    const organization = await prisma.organization.findUnique({
      where: { slug },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Find worker by PIN
    const worker = await prisma.worker.findUnique({
      where: { pin },
      select: {
        id: true,
        name: true,
        role: true,
        organizationId: true,
      },
    })

    if (!worker) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    // Check if worker belongs to this organization
    if (worker.organizationId !== organization.id) {
      return NextResponse.json(
        { error: 'This PIN belongs to a worker in a different organization' },
        { status: 403 }
      )
    }

    // Create or get User linked to this worker
    let user = await prisma.user.findUnique({
      where: { workerId: worker.id },
    })

    if (!user) {
      // Create user with workerPin for authentication
      user = await prisma.user.create({
        data: {
          name: worker.name,
          role: worker.role,
          organizationId: worker.organizationId,
          workerId: worker.id,
          workerPin: pin,
        },
      })
    }

    // Create a session for this user
    const sessionToken = `pin-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    return NextResponse.json({
      sessionToken,
      worker: {
        id: worker.id,
        name: worker.name,
        role: worker.role,
      },
    })
  } catch (error) {
    console.error('Join organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
