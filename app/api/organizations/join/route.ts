import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, clearAttempts, loginRateLimitKey, recordFailedAttempt } from '@/lib/loginRateLimit'
import { encodeWorkerCookie, WORKER_COOKIE, workerCookieOptions } from '@/lib/workerCookie'

// Invite-link sign-in. Works exactly like the organization PIN sign-in:
// the PIN is checked only inside this organization, guesses are rate limited,
// and the session is the same signed cookie.
export async function POST(request: NextRequest) {
  try {
    const { slug, pin } = await request.json()

    if (typeof slug !== 'string' || !slug || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const rateLimitKey = loginRateLimitKey(request, slug)
    const { allowed, retryAfter } = checkRateLimit(rateLimitKey)
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${retryAfter} seconds.` },
        { status: 429 }
      )
    }

    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const worker = await prisma.worker.findFirst({
      where: { pin, organizationId: organization.id },
      select: { id: true, name: true, role: true },
    })

    if (!worker) {
      recordFailedAttempt(rateLimitKey)
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    clearAttempts(rateLimitKey)

    const cookieStore = await cookies()
    cookieStore.set(WORKER_COOKIE, encodeWorkerCookie(worker.id, pin), workerCookieOptions())

    return NextResponse.json({
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
