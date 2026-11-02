import test from 'node:test'
import assert from 'node:assert/strict'
import { batchCardHeading } from '../lib/batchCardHeading'
test('structured vape variation leads with nonrepeating brand and format', () => {
 assert.deepEqual(batchCardHeading({name:'Zero Gravity - 1g Disposable Vape - Purple Punch',strain:'Purple Punch',product:{name:'Zero Gravity - 1g Disposable Vape',brand:'Zero Gravity'},recipe:{name:'Vape Packaging'}}),{title:'Purple Punch',subtitle:'Zero Gravity · 1g Disposable Vape'})
})
test('jar variation and custom fallback preserve meaningful names and numbers', () => {
 assert.equal(batchCardHeading({name:'Expected 642 - special run',recipe:{name:'Jar Packaging'}}).title,'Expected 642 - special run')
 assert.deepEqual(batchCardHeading({name:'Jar run',strain:'Black Cherry Fizz',product:{name:'14g Flower Jar',brand:'Stone Road'},recipe:{name:'Packaging'}}),{title:'Black Cherry Fizz',subtitle:'Stone Road · 14g Flower Jar'})
 assert.deepEqual(batchCardHeading({name:'Custom - 642',strain:' ',recipe:{name:'Custom - 642'}}),{title:'Custom - 642',subtitle:''})
})
