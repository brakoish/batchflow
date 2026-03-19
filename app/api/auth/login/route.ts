import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json()

    if (!pin || pin.length !== 4) {
      return NextResponse.json(
        { error: 'Invalid PIN format' },
        { status: 400 }
      )
    }

    const worker = await prisma.worker.findUnique({
      where: { pin },
      select: {
        id: true,
        name: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!worker) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      )
    }

    const cookieStore = await cookies()
    cookieStore.set('workerId', worker.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    // Check if worker has organization
    const hasOrganization = !!worker.organizationId && worker.organizationId !== 'default-org-id'
    const needsOrg = !hasOrganization

    return NextResponse.json({
      worker: {
        id: worker.id,
        name: worker.name,
        role: worker.role,
        organizationId: worker.organizationId,
      },
      needsOrg,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
