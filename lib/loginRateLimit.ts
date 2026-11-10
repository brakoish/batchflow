import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter
const attempts = new Map<string, { count: number; lockedUntil: number }>()
// A whole floor often shares one network address, so allow a few honest
// mistypes before a short pause.
const MAX_ATTEMPTS = 10
const LOCKOUT_MS = 5 * 60 * 1000 // 5 minutes

export function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
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

export function recordFailedAttempt(key: string) {
  const now = Date.now()
  const record = attempts.get(key) || { count: 0, lockedUntil: 0 }
  record.count += 1
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS
  }
  attempts.set(key, record)
}

export function clearAttempts(key: string) {
  attempts.delete(key)
}

// Keyed by organization + device address, so one person's mistyped PINs
// don't lock the whole team out.
export function loginRateLimitKey(request: NextRequest, slug: string) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  return `login:${slug}:${clientIp}`
}
