import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, clearAttempts, loginRateLimitKey, recordFailedAttempt } from '@/lib/loginRateLimit'
import { encodeWorkerCookie, WORKER_COOKIE, workerCookieOptions } from '@/lib/workerCookie'

export async function POST(request: NextRequest) {
  try {
    const { pin, slug } = await request.json()

    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Invalid PIN format' },
        { status: 400 }
      )
    }

    // Require slug — no global PIN login
    if (typeof slug !== 'string' || !slug) {
      return NextResponse.json(
        { error: 'Organization required. Please log in through your organization page.' },
        { status: 400 }
      )
    }

    const rateLimitKey = loginRateLimitKey(request, slug)
    const { allowed, retryAfter } = checkRateLimit(rateLimitKey)
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${retryAfter} seconds.` },
        { status: 429 }
      )
    }

    // Find organization by slug
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

    // Find worker by PIN scoped to this organization
    const worker = await prisma.worker.findFirst({
      where: {
        pin,
        organizationId: organization.id,
      },
      select: {
        id: true,
        name: true,
        role: true,
        organizationId: true,
      },
    })

    if (!worker) {
      recordFailedAttempt(rateLimitKey)
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      )
    }

    // Success — clear failed attempts
    clearAttempts(rateLimitKey)

    const cookieStore = await cookies()
    cookieStore.set(WORKER_COOKIE, encodeWorkerCookie(worker.id, pin), workerCookieOptions())

    return NextResponse.json({
      worker: {
        id: worker.id,
        name: worker.name,
        role: worker.role,
        organizationId: worker.organizationId,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
