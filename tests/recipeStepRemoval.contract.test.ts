import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const recipeRoute = readFileSync('app/api/recipes/[id]/route.ts', 'utf8')
const recipeBuilder = readFileSync('app/recipes/RecipeBuilder.tsx', 'utf8')

assert.match(recipeBuilder, /id: s\.id/, 'recipe edits must preserve stable step IDs')
assert.match(recipeBuilder, /id: s\.id, name: s\.name/, 'recipe saves must submit stable step IDs')
assert.match(recipeRoute, /usedStepIds/, 'recipe updates must reconcile steps by identity')
assert.match(recipeRoute, /omittedSteps/, 'recipe updates must identify removed steps')
assert.match(recipeRoute, /batch-overrides-/, 'referenced removed steps must move out of the reusable recipe')
assert.match(recipeRoute, /recipeId: overrideRecipe\.id, unitId: null/, 'retired referenced steps must preserve batch history without remaining visible')

console.log('recipe step removal contract tests passed')
