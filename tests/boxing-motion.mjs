import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { fighterPose, blendPose } from '../src/fight/animator.js';
const a = fighterPose('idle', 0, 0.1),
  b = fighterPose('idle', 0, 0.7);
assert.ok(Math.abs(a.x - b.x) > 5, 'boxer changes position between steps');
for (const joint of [0, 2, 4, 6, 7, 8, 9, 10])
  assert.notDeepEqual(a.joints[joint], b.joints[joint], 'head, hands, knees and feet remain alive');
const blended = blendPose(a, b, 0.016);
assert.ok(Math.abs(blended.x - a.x) < Math.abs(b.x - a.x), 'pose blends rather than snapping');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5177/#/fight');
await page.getByLabel('Fight mode').selectOption('Practice');
const canvas = page.locator('.fighting-arena canvas');
const frame = () => canvas.evaluate((c) => c.toDataURL());
const before = await frame();
await page.waitForTimeout(350);
assert.notEqual(await frame(), before, 'fighters move before starting');
await page.getByRole('button', { name: 'Start fight', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.fight-input').disabled);
const typing = await frame();
await page.waitForTimeout(350);
assert.notEqual(await frame(), typing, 'fighters keep moving while waiting for typing');
assert.equal(
  await page
    .locator('.challenge-meta')
    .innerText()
    .then((t) => /PUNCH|KICK|UPPERCUT/.test(t)),
  false,
);
assert.ok((await page.locator('.challenge-card').boundingBox()).height < 145);
await page.screenshot({ path: 'tests/boxing-desktop.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(80);
const paused = await frame();
await page.waitForTimeout(180);
assert.equal(await frame(), paused, 'pause freezes the pose');
await page.keyboard.press('Escape');
await page.getByLabel('Reduce motion').check();
await page.locator('.challenge-card').click();
await page.waitForTimeout(80);
const quiet = await frame();
await page.waitForTimeout(180);
assert.equal(await frame(), quiet, 'reduce motion disables ambient footwork');
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'tests/boxing-mobile.png' });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
assert.deepEqual(errors, []);
console.log(
  'PASS: living guard and footwork, smooth pose blending, compact overlay, no attack labels, paused/reduced motion freeze, mobile layout.',
);
await browser.close();
