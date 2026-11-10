import { createHmac, timingSafeEqual } from 'node:crypto'

// The PIN session cookie holds the worker id plus an HMAC signature so it
// can't be forged by editing the cookie. Format: `<workerId>.<signature>`.
export const WORKER_COOKIE = 'workerId'
export const WORKER_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function secret() {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ''
}

// The signature also covers the worker's current PIN, so changing a PIN
// signs that worker out everywhere.
function sign(workerId: string, pin: string, key: string) {
  return createHmac('sha256', key).update(`worker:${workerId}:${pin}`).digest('base64url')
}

function signingKey() {
  const key = secret()
  if (!key && process.env.NODE_ENV === 'production') {
    // Fail closed: without a secret a cookie could be forged.
    throw new Error('NEXTAUTH_SECRET must be set to sign PIN sessions')
  }
  // Local development only.
  return key || 'batchflow-local-development-only'
}

export function encodeWorkerCookie(workerId: string, pin: string) {
  return `${workerId}.${sign(workerId, pin, signingKey())}`
}

// Reads the worker id out of the cookie without trusting it yet.
export function readWorkerCookieId(value: string | undefined | null) {
  if (!value) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  return value.slice(0, dot)
}

// True only when the cookie was issued by this server for this worker and PIN.
export function verifyWorkerCookie(value: string, workerId: string, pin: string) {
  const dot = value.lastIndexOf('.')
  if (dot <= 0 || value.slice(0, dot) !== workerId) return false
  const given = Buffer.from(value.slice(dot + 1))
  const expected = Buffer.from(sign(workerId, pin, signingKey()))
  return given.length === expected.length && timingSafeEqual(given, expected)
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
