import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeWorkerCookie, readWorkerCookieId, verifyWorkerCookie } from '../lib/workerCookie'

process.env.NEXTAUTH_SECRET = 'test-secret'

test('a cookie issued at sign-in verifies for that worker and PIN', () => {
  const value = encodeWorkerCookie('worker_123', '4821')
  assert.equal(readWorkerCookieId(value), 'worker_123')
  assert.equal(verifyWorkerCookie(value, 'worker_123', '4821'), true)
})

test('a bare worker id, as in the old cookie, is not accepted', () => {
  assert.equal(readWorkerCookieId('worker_123'), null)
  assert.equal(verifyWorkerCookie('worker_123', 'worker_123', '4821'), false)
})

test('editing the id inside a cookie breaks it', () => {
  const value = encodeWorkerCookie('worker_123', '4821')
  const forged = value.replace('worker_123', 'owner_999')
  assert.equal(verifyWorkerCookie(forged, 'owner_999', '4821'), false)
})

test('changing a PIN signs that worker out', () => {
  const value = encodeWorkerCookie('worker_123', '4821')
  assert.equal(verifyWorkerCookie(value, 'worker_123', '9999'), false)
})

test('a cookie signed with another secret is rejected', () => {
  const value = encodeWorkerCookie('worker_123', '4821')
  process.env.NEXTAUTH_SECRET = 'rotated-secret'
  assert.equal(verifyWorkerCookie(value, 'worker_123', '4821'), false)
  process.env.NEXTAUTH_SECRET = 'test-secret'
})
