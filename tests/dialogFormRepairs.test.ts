import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = (p: string) => readFileSync(p, 'utf8')
const recipe = source('app/recipes/RecipeBuilder.tsx')
const body = recipe.split('const validationError = (() => {')[1].split('  })()')[0]
const validate = (patch: Record<string, unknown> = {}) => {
 const state = { name: 'Workflow', baseUnit: 'Jars', steps: [{ name: 'Pack' }], products: [{name:'Jar',brand:'Brand',materialWeightGrams:''}], duplicateUnits: [], duplicateSteps: [], missingStepUnits: [], trimmedUnits: [], ...patch }
 return Function(...Object.keys(state), body)(...Object.values(state))
}
test('readiness and submit share exact validation including blank steps, brand, ratios and weights', () => {
 assert.equal(validate(), '')
 for (const patch of [{steps:[{name:' '}]}, {products:[{name:'Jar', brand:'',materialWeightGrams:''}]}, {trimmedUnits:[{name:'Case',count:0}]}, {trimmedUnits:[{name:'Case',count:NaN}]}, {products:[{name:'Jar',brand:'Brand',materialWeightGrams:'-2'}]}, {products:[{name:'Jar',brand:'Brand',materialWeightGrams:'abc'}]}]) assert.ok(validate(patch))
 assert.match(recipe, /if \(validationError\) \{\s*setError\(validationError\)/)
 assert.match(recipe, /\{!validationError &&/)
})
test('dialog callbacks do not restart focus, and topmost isolation is restored', () => {
 const hook = source('app/components/useDialogFocus.ts')
 for (const token of ['state.current = { onClose, busy }', 'if (!top()) return', 'sibling.inert = true', 'node.inert = inert', "document.body.style.overflow = originalOverflow", '[ref, open]']) assert.ok(hook.includes(token), token)
 assert.doesNotMatch(hook, /\[ref, open, onClose/)
})
test('organization results remain mounted while keyboard focus stays inside the search', () => {
 const page = source('app/page.tsx')
 assert.match(page, /contains\(event.relatedTarget/)
 assert.doesNotMatch(page, /setTimeout\(\(\) => setFocused\(false\)/)
 for(const key of ['ArrowDown','ArrowUp','Escape','data-org-result']) assert.ok(page.includes(key))
})
