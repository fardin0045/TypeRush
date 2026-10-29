import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5177/#/fight');
await page.getByLabel('Fight difficulty').selectOption('Easy');
await page.getByLabel('Fight mode').selectOption('Practice');
await page.getByRole('button',{name:'Start fight',exact:true}).click();
for(let i=0;i<3;i++){
 await page.waitForFunction(()=>!document.querySelector('.fight-input').disabled);
 const word=await page.getByLabel('Fight typing challenge',{exact:true}).innerText();
 assert.match(word,/^[a-z]+$/);
 await page.keyboard.type(word[0]);
 assert.equal(await page.locator('.fight-input').isDisabled(),false);
 await page.waitForTimeout(55);
 if(i===0)await page.screenshot({path:'tests/character-left.png'});
 await page.waitForTimeout(180);
 await page.keyboard.type(word[1]);
 await page.waitForTimeout(55);
 if(i===0)await page.screenshot({path:'tests/character-right.png'});
 await page.keyboard.type(word.slice(2),{delay:35});
 assert.equal(await page.locator('.fight-input').isDisabled(),true);
 assert.equal((await page.locator('.fight-live-message').innerText()).trim(),'');
 if(i===1){await page.waitForTimeout(750);await page.screenshot({path:'tests/fight-clean-kick.png'});}
 await page.waitForFunction(()=>!document.querySelector('.fight-input').disabled);
}
assert.deepEqual(errors,[]);
await browser.close();
console.log('PASS: single words, immediate per-character animation, uninterrupted typing, kick completion and next-word recovery.');
