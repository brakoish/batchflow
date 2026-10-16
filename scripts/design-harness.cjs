// Synthetic, anonymous visual regression surface. Uses the project's actual compiled CSS.
const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')
const tailwind = require('@tailwindcss/postcss')
const root = path.resolve(__dirname, '..')
const out = process.argv[2] || '/tmp/batchflow-design-harness'
async function main() {
  fs.mkdirSync(out, { recursive: true })
  const result = await postcss([tailwind({ base: root })]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') })
  fs.writeFileSync(path.join(out, 'style.css'), result.css)
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"><title>BatchFlow synthetic selection regression</title></head><body class="bg-background text-foreground"><main class="max-w-2xl mx-auto px-4 py-5"><h1 class="text-xl font-bold">Anonymous UI regression fixture</h1><p class="text-muted-foreground">Synthetic controls; no production records or requests.</p><section class="my-4 rounded-xl bg-card p-4"><h2>Batch type</h2><div class="grid grid-cols-2 gap-2"><button id="fixed" aria-pressed="false" class="bf-select-btn">Fixed</button><button id="open" aria-pressed="true" class="bf-select-btn bf-select-btn-active">✓ Open</button></div><h2 class="mt-4">Priority</h2><div class="grid grid-cols-4 gap-2">${['Low','Normal','High','Urgent'].map(x => `<button id="priority-${x}" aria-pressed="${x==='Normal'}" class="bf-select-btn ${x==='Normal'?'bf-select-btn-active':''}">${x==='Normal'?'✓ ':''}${x}</button>`).join('')}</div><h2 class="mt-4">Deadline</h2><button id="deadline" aria-pressed="true" class="bf-select-btn bf-select-btn-active">✓ Tomorrow</button><button id="deadline-off" aria-pressed="false" class="bf-select-btn">Next week</button><h2 class="mt-4">Workers</h2><button id="worker" aria-pressed="true" class="bf-select-btn bf-select-btn-active">✓ Fixture worker A</button><button id="worker-off" aria-pressed="false" class="bf-select-btn">Fixture worker B</button><h2 class="mt-4">Utility overrides and themes</h2><button id="check" aria-pressed="true" class="bf-select-btn border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 min-h-[64px] justify-start">✓ Check</button><button id="disabled" disabled class="bf-select-btn">Saving…</button><button id="success" class="bf-btn bf-btn-success">Log progress</button><p id="dark-probe" class="text-blue-600 dark:text-blue-400">Theme utility probe</p></section><button id="desktop-cta" class="bf-btn bf-btn-primary hidden sm:inline-flex">Create Batch</button><div class="sm:hidden"><button id="mobile-cta" class="bf-btn bf-btn-primary">Create Batch</button></div></main></body></html>`)
  console.log(out)
}
main().catch(e => { console.error(e); process.exitCode = 1 })
