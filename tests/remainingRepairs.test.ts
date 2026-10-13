import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { translateUi } from '../lib/uiLocale'
const source = (path: string) => readFileSync(path, 'utf8')
test('Chinese core controls render deterministically without translating authored values', () => {
  assert.equal(translateUi('Enter', 'zh-CN'), '输入')
  assert.equal(translateUi('Record measurement in g', 'zh-CN'), '记录测量值，单位：g')
  assert.equal(translateUi('Custom strain', 'zh-CN'), 'Custom strain')
  assert.equal(translateUi('Enter', 'en'), 'Enter')
  assert.doesNotMatch(source('app/components/UiTranslation.tsx'), /MutationObserver|nodeValue/)
})
test('legacy workflows have an explicit productless setup choice', () => {
  const creator = source('app/batches/new/BatchCreator.tsx')
  assert.match(creator, /Legacy workflows/)
  assert.match(creator, /recipe.products.length === 0/)
  assert.match(creator, /productId: productId \|\| undefined/)
})
test('material writes coordinate with production organization lock', () => {
  assert.match(source('app/api/batches/[id]/materials/route.ts'), /withOperationalLock\(session.user.organizationId/)
})
test('combobox and recording dialogs expose keyboard semantics', () => {
  const picker = source('app/components/ProductPicker.tsx')
  for (const token of ['aria-activedescendant', 'ArrowDown', 'ArrowUp', 'closePicker', 'role="combobox"']) assert.ok(picker.includes(token))
  assert.match(source('app/batches/[id]/BatchDetailClient.tsx'), /useDialogFocus\(recordingDialogRef/)
})

test('recording focus ref belongs only to the recording panel and busy state does not restart focus', () => {
  assert.equal(source('app/batches/[id]/BatchDetailClient.tsx').split('ref={recordingDialogRef}').length - 1, 1)
  assert.match(source('app/components/useDialogFocus.ts'), /busyRef.current/)
  assert.doesNotMatch(source('app/components/useDialogFocus.ts'), /\[ref, open, onClose, busy\]/)
})
