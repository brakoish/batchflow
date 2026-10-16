import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'

const css = readFileSync('app/globals.css', 'utf8')

test('compiled shared button family is layered, utilities remain able to override display', async () => {
  const result = await postcss([tailwind()]).process(css, { from: 'app/globals.css' })
  const root = postcss.parse(result.css)
  let buttons = 0
  root.walkRules(rule => {
    if (!/\.bf-(?:btn|icon-btn|select-btn)/.test(rule.selector)) return
    buttons++
    let parent: postcss.Node | undefined = rule.parent
    while (parent && !(parent.type === 'atrule' && (parent as postcss.AtRule).name === 'layer' && (parent as postcss.AtRule).params === 'components')) parent = parent.parent
    assert.ok(parent, `${rule.selector} must not escape components layer`)
  })
  assert.ok(buttons > 20)
  assert.match(result.css, /\.hidden\s*\{\s*display: none/)
  assert.match(result.css, /:where\(\.dark, \.dark \*\)/)
  assert.match(result.css, /\.bf-select-btn\[aria-pressed="true"\]:hover:not\(:disabled\)/)
})

function luminance(hex: string) {
  const values = hex.match(/[\da-f]{2}/gi)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2]
}
function contrast(a: string, b: string) { const values = [luminance(a), luminance(b)].sort((a,b) => b-a); return (values[0]+.05)/(values[1]+.05) }
test('semantic text and on-fill colors meet 4.5:1 in both themes', () => {
  for (const [name, section, surface] of [['light', css.split('.dark {')[0], '#ffffff'], ['dark', css.split('.dark {')[1].split('\n}')[0], '#141414']]) {
    for (const token of ['success', 'destructive']) {
      const fill = section.match(new RegExp(`--color-${token}: (#[\\da-f]+);`))![1]
      const foreground = section.match(new RegExp(`--color-${token}-foreground: (#[\\da-f]+);`))![1]
      assert.ok(contrast(fill, surface) >= 4.5, `${name} ${token} text`)
      assert.ok(contrast(fill, foreground) >= 4.5, `${name} ${token} on-fill`)
    }
  }
  assert.ok(contrast('#047857', '#ffffff') >= 4.5)
})
test('v4 theme owns migrated animation and safe spacing without stale config', () => {
  assert.equal(existsSync('tailwind.config.ts'), false)
  for (const token of ['--spacing-safe:', '--spacing-safe-top:', '--animate-slide-up:', '--animate-slide-down:', '--font-sans:']) assert.ok(css.includes(token))
  assert.doesNotMatch(readFileSync('app/layout.tsx', 'utf8'), /maximumScale/)
})
