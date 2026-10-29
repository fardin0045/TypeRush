import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5177/#/fight');
await page.getByLabel('Fight difficulty').selectOption('Easy');
await page.getByRole('button',{name:'Start fight',exact:true}).click();
for(let i=0;i<15;i++){
 await page.waitForFunction(()=>!document.querySelector('.fight-input').disabled);
 const word=await page.getByLabel('Fight typing challenge',{exact:true}).innerText();
 await page.keyboard.type(word);
 await page.waitForFunction(()=>!document.querySelector('.fight-input').disabled || parseInt(document.querySelector('.health-card.enemy b').textContent)===0);
 if(parseInt(await page.locator('.health-card.enemy b').innerText())===0)break;
}
assert.equal(await page.locator('.fight-result').count(),0);
await page.waitForTimeout(330);
await page.screenshot({path:'tests/knockout-flight.png'});
assert.equal(await page.locator('.fight-result').count(),0);
await page.getByRole('dialog',{name:'Match results'}).waitFor();
assert.match(await page.locator('.fight-result h2').innerText(),/You win/);
assert.deepEqual(errors,[]);await browser.close();
console.log('PASS: real match knockout, visible airborne finish, delayed results, no runtime errors.');
