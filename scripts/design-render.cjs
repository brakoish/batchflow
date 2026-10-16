// Requires existing Playwright, supplied by the operator; no project dependency added.
const fs = require('node:fs')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || '/home/jimbo/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core')
async function main() {
 const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
 const out = process.argv[2] || '/tmp/batchflow-design-render'
 fs.mkdirSync(out,{recursive:true})
 const results=[]
 for (const os of ['light','dark']) for (const theme of ['light','dark']) for (const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:os})
  const page=await context.newPage()
  await page.goto('http://127.0.0.1:8769/index.html')
  await page.evaluate(t=>{ document.documentElement.classList.toggle('dark',t==='dark'); const s=document.createElement('style'); s.textContent='*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.append(s) },theme)
  const computed=await page.evaluate(()=>{
   const style=id=>{const e=document.getElementById(id),s=getComputedStyle(e),r=e.getBoundingClientRect();return {background:s.backgroundColor,color:s.color,border:s.borderColor,display:s.display,minHeight:s.minHeight,justify:s.justifyContent,opacity:s.opacity,width:r.width,height:r.height}}
   return Object.fromEntries(['fixed','open','priority-Normal','priority-Low','deadline','deadline-off','worker','worker-off','check','disabled','success','dark-probe','desktop-cta','mobile-cta'].map(id=>[id,style(id)]))
  })
  for(const [on,off] of [['open','fixed'],['priority-Normal','priority-Low'],['deadline','deadline-off'],['worker','worker-off']]) assert.notEqual(computed[on].background,computed[off].background,`${on} selection ${theme}`)
  assert.equal(computed.check.minHeight,'64px')
  assert.equal(computed.check.justify,'flex-start')
  assert.ok(Number(computed.disabled.opacity)<1)
  const visible=await page.locator('button').filter({hasText:'Create Batch'}).evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).length)
  assert.equal(visible,1,`CTA count ${width}`)
  await page.locator('#open').hover()
  const hover=await page.locator('#open').evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}))
  assert.notEqual(hover.background,computed.fixed.background, 'selected hover remains distinct')
  await page.locator('#open').focus()
  const focus=await page.locator('#open').evaluate(e=>getComputedStyle(e).outlineStyle)
  await page.screenshot({path:`${out}/${theme}-os-${os}-${width}.png`,fullPage:true})
  results.push({os,theme,width,visible,computed,hover,focus})
  await context.close()
 }
 for(const theme of ['light','dark']) {
  const a=results.find(x=>x.os==='light'&&x.theme===theme),b=results.find(x=>x.os==='dark'&&x.theme===theme)
  assert.equal(a.computed['dark-probe'].color,b.computed['dark-probe'].color,'manual theme independent of OS')
 }
 fs.writeFileSync(`${out}/computed.json`,JSON.stringify(results,null,2))
 console.log(`PASS: ${results.length} rendered theme/OS/viewport combinations; screenshots and computed styles: ${out}`)
 await browser.close()
}
main().catch(e=>{console.error(e);process.exitCode=1})
