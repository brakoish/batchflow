import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter for PIN sign-in.
// Failures are counted in a rolling window and are NOT cleared by a successful
// sign-in, so a worker can't interleave their own PIN to keep guessing others.
type Record = { count: number; windowStart: number; lockedUntil: number }
const attempts = new Map<string, Record>()

const WINDOW_MS = 5 * 60 * 1000 // 5 minutes
// A whole floor often shares one network address, so allow a few honest
// mistypes per device before a short pause.
const MAX_PER_DEVICE = 10
// Ceiling for the whole organization, so guesses spread across many
// addresses still hit a limit.
const MAX_PER_ORG = 40

function check(key: string, now: number) {
  const record = attempts.get(key)
  if (!record) return 0
  if (record.lockedUntil > now) return Math.ceil((record.lockedUntil - now) / 1000)
  if (now - record.windowStart > WINDOW_MS || record.lockedUntil) attempts.delete(key)
  return 0
}

function bump(key: string, max: number, now: number) {
  let record = attempts.get(key)
  if (!record || now - record.windowStart > WINDOW_MS) record = { count: 0, windowStart: now, lockedUntil: 0 }
  record.count += 1
  if (record.count >= max) record.lockedUntil = now + WINDOW_MS
  attempts.set(key, record)
}

function keys(request: NextRequest, slug: string) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  return { device: `login:${slug}:${clientIp}`, org: `login-org:${slug}` }
}

export function checkLoginRateLimit(request: NextRequest, slug: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const { device, org } = keys(request, slug)
  const retryAfter = Math.max(check(device, now), check(org, now))
  return retryAfter > 0 ? { allowed: false, retryAfter } : { allowed: true }
}

export function recordFailedLogin(request: NextRequest, slug: string) {
  const now = Date.now()
  const { device, org } = keys(request, slug)
  bump(device, MAX_PER_DEVICE, now)
  bump(org, MAX_PER_ORG, now)
}
