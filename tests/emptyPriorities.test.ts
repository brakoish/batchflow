import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const component = readFileSync('app/components/DirectedTasks.tsx', 'utf8')
const shell = readFileSync('app/components/AppShell.tsx', 'utf8')
test('personal panel hides only after successful empty fetch, never on error or loading', () => {
 assert.match(component, /if\(!data\)return badge\|\|noticeOnly\?null:<p role="status"/)
 assert.match(component, /setData\(await fetchTasks\(\)\);setError\(''\)/)
 assert.match(component, /if\(!manage&&!tasks.length&&!error\)return null/)
 assert.ok(component.indexOf('if(!data)') < component.indexOf('if(!manage&&!tasks.length&&!error)'))
 assert.match(component, /if\(!r.ok\)throw Error/)
})
test('some tasks, manager empty state and unread notices retain existing semantics', () => {
 assert.match(component, /const tasks=\(manage\?data.tasks:mine\).filter\(t=>!batchId\|\|t.batchId===batchId\)/)
 assert.match(component, /const mine=data.tasks.filter\(t=>t.assignments.some\(a=>a.workerId===data.workerId&&!a.removedAt\)\)/)
 assert.match(component, /a.seenRevision<t.contentRevision/)
 assert.match(component, /No directed tasks yet/)
 assert.ok(component.indexOf('if(badge)return') < component.indexOf('if(!manage&&!tasks.length&&!error)'))
})
test('owner and supervisor planning navigation is permanent and independent of task fetch', () => {
 assert.match(shell, /\['OWNER','SUPERVISOR'\].includes\(session.role\) \? <Link href="\/tasks"/)
 assert.match(shell, />Plan work<DirectedTasks noticeOnly \/><\/Link> : <DirectedTasks badge \/>/)
 const page = readFileSync('app/tasks/page.tsx','utf8')
 assert.match(page, /if \(!\['OWNER','SUPERVISOR'\].includes\(session.role\)\) redirect\('\/workers\/me'\)/)
})
