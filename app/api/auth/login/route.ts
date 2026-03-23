import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { pin, slug } = await request.json()

    if (!pin || pin.length !== 4) {
      return NextResponse.json(
        { error: 'Invalid PIN format' },
        { status: 400 }
      )
    }

    let worker

    // If slug is provided, find worker by PIN AND organization
    if (slug) {
      // First, find the organization by slug
      const organization = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!organization) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        )
      }

      // Then find worker by PIN and organizationId
      worker = await prisma.worker.findFirst({
        where: {
          pin,
          organizationId: organization.id,
        },
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
    } else {
      // No slug provided - use global PIN lookup (backward compat)
      worker = await prisma.worker.findUnique({
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
    }

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
