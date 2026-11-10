import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const ui = readFileSync('app/workers/WorkerManager.tsx', 'utf8')
const api = readFileSync('app/api/workers/[id]/route.ts', 'utf8')
test('employee editor opens visibly at the current viewport with accessible close and focus restoration', () => {
 for (const token of ['fixed inset-0', 'role="dialog"', 'aria-modal="true"', 'useDialogFocus(editorRef, showEditModal, closeEditor, loading)', 'max-h-[90dvh]', 'autoFocus', 'onClick={closeEditor}', '>Cancel</button>']) assert.ok(ui.includes(token), token)
})
test('name-only edits omit unchanged sensitive employee settings', () => {
 for (const token of ['name: editName.trim()', 'editRole !== editingWorker.role', 'editHourlyRate !==', 'editPreferredLanguage !==', 'JSON.stringify([...editTeamIds].sort()) !==']) assert.ok(ui.includes(token), token)
})
test('worker update retains owner authorization and tenant target lookup and validates names', () => {
 assert.ok(api.includes('await requireOwner()'))
 assert.ok(api.includes('where: { id, organizationId: session.user.organizationId }'))
 const validation = api.split('    if (name !== undefined) {')[1].split('    if (role')[0].replace(/\n    }\s*$/, '')
 const validate = (name: unknown) => Function('name', 'NextResponse', 'updateData', validation + '; return updateData.name' ) (name, {json: (body: unknown) => body}, {})
 assert.equal(validate('  New Name  '), 'New Name')
 for (const name of ['', '   ', 12, {}, 'x'.repeat(121)]) assert.deepEqual(validate(name), {error:'Name must be between 1 and 120 characters'})
})
