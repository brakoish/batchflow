import { createHmac, timingSafeEqual } from 'node:crypto'

// The PIN session cookie holds the worker id plus an HMAC signature so it
// can't be forged by editing the cookie. Format: `<workerId>.<signature>`.
export const WORKER_COOKIE = 'workerId'
export const WORKER_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function secret() {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ''
}

function sign(workerId: string, key: string) {
  return createHmac('sha256', key).update(`worker:${workerId}`).digest('base64url')
}

export function encodeWorkerCookie(workerId: string) {
  const key = secret()
  if (!key) {
    console.error('NEXTAUTH_SECRET is not set; PIN session cookies are unsigned')
    return workerId
  }
  return `${workerId}.${sign(workerId, key)}`
}

// Returns the worker id when the cookie is genuine, otherwise null.
export function decodeWorkerCookie(value: string | undefined | null) {
  if (!value) return null
  const key = secret()
  if (!key) return value.includes('.') ? value.slice(0, value.indexOf('.')) : value
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  const workerId = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1))
  const expected = Buffer.from(sign(workerId, key))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return workerId
}

export function workerCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: WORKER_COOKIE_MAX_AGE,
    expires: new Date(Date.now() + WORKER_COOKIE_MAX_AGE * 1000), // iOS PWA needs explicit expires
  }
}
