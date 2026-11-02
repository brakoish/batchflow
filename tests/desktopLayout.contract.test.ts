import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const source = (path: string) => readFileSync(path, 'utf8')
test('desktop layout widens only at large breakpoint and preserves phone widths', () => {
  for (const path of ['app/batches/BatchListClient.tsx', 'app/batches/[id]/BatchDetailClient.tsx']) {
    assert.match(source(path), /max-w-2xl lg:max-w-\[1440px\]/)
  }
  assert.match(source('app/batches/BatchListClient.tsx'), /lg:grid lg:grid-cols-3/)
  assert.match(source('app/batches/[id]/BatchDetailClient.tsx'), /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.6fr\)\]/)
})
test('supplementary desktop navigation has real routes and no duplicate primary batch link', () => {
  const header = source('app/components/Header.tsx')
  const links = header.slice(header.indexOf('const desktopLinks'), header.indexOf('const navItems'))
  assert.doesNotMatch(links, /href: '\/batches'/)
  for (const match of links.matchAll(/href: '([^']+)'/g)) assert.ok(existsSync(`app${match[1]}/page.tsx`), match[1])
  assert.match(header, /aria-label="Desktop workspace" className="hidden lg:flex/)
})

test('all desktop batch lists use three bounded columns and dashboard avoids name walls', () => {
  assert.match(source('app/globals.css'), /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(source('app/dashboard/DashboardClient.tsx'), /batch-card-grid dashboard-batch-grid/)
  assert.match(source('app/dashboard/DashboardClient.tsx'), /assignmentSummary\(batch.assignments\)/)
  assert.doesNotMatch(source('app/dashboard/DashboardClient.tsx'), /batch.assignments.map\(a => a.worker.name/)
})
