import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('batch deletion is available for empty batches and guarded server-side', () => {
  const manage = read('app/batches/[id]/manage/ManageBatchClient.tsx')
  const route = read('app/api/batches/[id]/route.ts')

  assert.match(manage, /Delete Mistaken Batch/)
  assert.match(manage, /session\.role === 'OWNER' && !hasRecordedWork/)
  assert.match(route, /progressLog\.count/)
  assert.match(route, /batchRemoval\.count/)
  assert.match(route, /batchMaterialEvent\.count/)
  assert.match(route, /batchMessage\.count/)
  assert.match(route, /BATCH_HAS_RECORDED_WORK/)
  assert.doesNotMatch(route, /Only cancelled batches can be deleted/)
})
