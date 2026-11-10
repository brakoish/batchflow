import test from 'node:test'
import assert from 'node:assert/strict'
import type { NextRequest } from 'next/server'
import { checkLoginRateLimit, recordFailedLogin } from '../lib/loginRateLimit'

const req = (ip: string) => ({ headers: new Headers({ 'x-forwarded-for': ip }) }) as unknown as NextRequest

test('a device is paused after 10 failed PINs, even with successes in between', () => {
  const r = req('10.0.0.1')
  for (let i = 0; i < 9; i++) recordFailedLogin(r, 'shop-a')
  assert.equal(checkLoginRateLimit(r, 'shop-a').allowed, true)
  // a correct PIN here no longer resets the count
  recordFailedLogin(r, 'shop-a')
  assert.equal(checkLoginRateLimit(r, 'shop-a').allowed, false)
})

test('other devices are unaffected by one device pausing', () => {
  assert.equal(checkLoginRateLimit(req('10.0.0.2'), 'shop-a').allowed, true)
})

test('guesses spread across many addresses hit the organization ceiling', () => {
  for (let i = 0; i < 40; i++) recordFailedLogin(req(`10.1.0.${i}`), 'shop-b')
  assert.equal(checkLoginRateLimit(req('10.9.9.9'), 'shop-b').allowed, false)
  assert.equal(checkLoginRateLimit(req('10.9.9.9'), 'shop-c').allowed, true)
})
