import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

test('products view manages variations without deleting historical identities', () => {
  const page = fs.readFileSync('app/products/page.tsx', 'utf8')
  const manager = fs.readFileSync('app/products/ProductsManager.tsx', 'utf8')
  const createRoute = fs.readFileSync('app/api/products/[id]/variations/route.ts', 'utf8')
  const archiveRoute = fs.readFileSync('app/api/products/[id]/variations/[variationId]/route.ts', 'utf8')

  assert.match(page, /variations:\s*\{/)
  assert.match(manager, /Products & variations/)
  assert.match(manager, /Add strain or flavor/)
  assert.match(manager, /Existing history stays intact/)

  assert.match(createRoute, /organizationId: session\.user\.organizationId/)
  assert.match(createRoute, /name: \{ equals: name, mode: 'insensitive' \}/)
  assert.match(createRoute, /archivedAt: null/)
  assert.match(archiveRoute, /product: \{ organizationId: session\.user\.organizationId \}/)
  assert.match(archiveRoute, /data: \{ archivedAt: body\.archived \? new Date\(\) : null \}/)
  assert.doesNotMatch(archiveRoute, /\.delete\(/)
})
