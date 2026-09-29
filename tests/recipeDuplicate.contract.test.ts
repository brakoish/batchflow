import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const duplicateRoute = readFileSync('app/api/recipes/[id]/duplicate/route.ts', 'utf8')

assert.match(duplicateRoute, /requireSupervisorOrOwner\(\)/, 'recipe duplication requires supervisor or owner')
assert.match(duplicateRoute, /organizationId/, 'source recipe lookup is organization scoped')
assert.match(duplicateRoute, /source\.units/, 'recipe duplication copies unit conversions')
assert.match(duplicateRoute, /source\.steps/, 'recipe duplication copies workflow steps')
assert.doesNotMatch(duplicateRoute, /source\.products/, 'recipe duplication must not clone product records')
assert.doesNotMatch(duplicateRoute, /products:\s*\{\s*create:/, 'recipe duplication must not create duplicate products')

console.log('recipe duplicate contract tests passed')
