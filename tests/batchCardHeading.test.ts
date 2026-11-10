import test from 'node:test'
import assert from 'node:assert/strict'
import { batchCardHeading } from '../lib/batchCardHeading'
test('structured vape variation leads with nonrepeating brand and format', () => {
 assert.deepEqual(batchCardHeading({name:'Zero Gravity - 1g Disposable Vape - Purple Punch',strain:'Purple Punch',product:{name:'Zero Gravity - 1g Disposable Vape',brand:'Zero Gravity'},recipe:{name:'Vape Packaging'}}),{title:'Purple Punch · Disposable',subtitle:'Zero Gravity · 1g Disposable Vape'})
})
test('jar variation and custom fallback preserve meaningful names and numbers', () => {
 assert.equal(batchCardHeading({name:'Expected 642 - special run',recipe:{name:'Jar Packaging'}}).title,'Expected 642 - special run')
 assert.deepEqual(batchCardHeading({name:'Jar run',strain:'Black Cherry Fizz',product:{name:'14g Flower Jar',brand:'Stone Road'},recipe:{name:'Packaging'}}),{title:'Black Cherry Fizz',subtitle:'Stone Road · 14g Flower Jar'})
 assert.deepEqual(batchCardHeading({name:'Custom - 642',strain:' ',recipe:{name:'Custom - 642'}}),{title:'Custom - 642',subtitle:''})
})

test('same strain distinguishes 1g 510 cartridge from disposable, including long names', () => {
 for (const strain of ['Black Cherry Fizz', 'Purple Punch', 'A very long strain name with numbers 642']) {
  for (const [name, format] of [['Zero Gravity - 1g 510 Vape Cartridge', 'Cartridge'], ['Zero Gravity - 1g Disposable Vape', 'Disposable'], ['1g 510 Vape', 'Cartridge']]) {
   assert.equal(batchCardHeading({name:'Old custom batch label',strain,product:{name,brand:'Zero Gravity'},recipe:{name:'Vape Packaging'}}).title, `${strain} · ${format}`)
  }
 }
 assert.equal(batchCardHeading({name:'Custom non-vape run 642',product:{name:'14g Flower Jar'},recipe:{name:'Jar Packaging'}}).title, 'Custom non-vape run 642')
})

 test('flower bags retain size and pre-roll packs distinguish count from each-roll weight', () => {
 for (const [product, expected] of [['14g Flower Bag', '14g Flower Bags'], ['3.5g Flower Bag', '3.5g Flower Bags'], ['5-Pack 0.5g Pre-Rolls', '5 × 0.5g Pre-Rolls']]) {
 assert.equal(batchCardHeading({name:'Old run name',strain:'Purple Ringer',product:{name:product,brand:'Red Eye'},recipe:{name:'Packaging'}}).title, `Purple Ringer · ${expected}`)
 }
})
