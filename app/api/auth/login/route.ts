import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Simple in-memory rate limiter
const attempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = attempts.get(key)

  if (record) {
    if (record.lockedUntil > now) {
      return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) }
    }
    if (record.lockedUntil <= now && record.count >= MAX_ATTEMPTS) {
      // Lockout expired, reset
      attempts.delete(key)
    }
  }

  return { allowed: true }
}

function recordFailedAttempt(key: string) {
  const now = Date.now()
  const record = attempts.get(key) || { count: 0, lockedUntil: 0 }
  record.count += 1
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS
  }
  attempts.set(key, record)
}

function clearAttempts(key: string) {
  attempts.delete(key)
}

export async function POST(request: NextRequest) {
  try {
    const { pin, slug } = await request.json()

    if (!pin || pin.length !== 4) {
      return NextResponse.json(
        { error: 'Invalid PIN format' },
        { status: 400 }
      )
    }

    // Require slug — no global PIN login
    if (!slug) {
      return NextResponse.json(
        { error: 'Organization required. Please log in through your organization page.' },
        { status: 400 }
      )
    }

    // Rate limit by slug
    const rateLimitKey = `login:${slug}`
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
    cookieStore.set('workerId', worker.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

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
