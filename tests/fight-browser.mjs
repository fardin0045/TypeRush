import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5177/#/games');
await page.getByRole('heading', { name: 'Choose your kind of fast.' }).waitFor();
await page.locator('.game-cards a').last().click();
await page.getByLabel('Fight difficulty').selectOption('Easy');
await page.screenshot({ path: 'tests/fight-ready.png' });
await page.getByRole('button', { name: 'Start fight', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.fight-input').disabled);
await page.keyboard.type('~');
assert.equal(await page.locator('.fight-word .bad').count(), 1);
await page.keyboard.press('Backspace');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Resume fight', exact: true }).first().waitFor();
await page.keyboard.press('Escape');
for (let round = 0; round < 22; round++) {
  if (await page.getByRole('dialog', { name: 'Match results' }).count()) break;
  await page.waitForFunction(
    () =>
      document.querySelector('.fight-result') || !document.querySelector('.fight-input').disabled,
  );
  if (await page.locator('.fight-result').count()) break;
  const word = await page.getByLabel('Fight typing challenge', { exact: true }).innerText();
  await page.keyboard.type(word, { delay: 45 });
  await page.waitForFunction(
    () =>
      document.querySelector('.fight-result') || document.querySelector('.fight-input').disabled,
  );
  if (round === 2) await page.screenshot({ path: 'tests/fight-combo.png' });
}
await page.getByRole('dialog', { name: 'Match results' }).waitFor();
assert.match(await page.locator('.fight-result h2').innerText(), /You win/);
assert.ok(
  await page.evaluate(() => JSON.parse(localStorage.getItem('typerush.v1')).fight.wins === 1),
);
await page.screenshot({ path: 'tests/fight-results.png' });
await page.getByRole('button', { name: 'Fight again', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.fight-input').disabled);
assert.match(await page.locator('.health-card.player b').innerText(), /100/);
await page.getByRole('link', { name: 'TypeRush', exact: true }).click();
await page.getByRole('button', { name: 'Start race', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.input-row input').disabled);
const text = await page.getByLabel('Typing passage', { exact: true }).innerText();
await page.keyboard.type(text, { delay: 20 });
await page.getByRole('dialog', { name: 'Race results' }).waitFor();
await page.goto('http://127.0.0.1:5177/#/fight');
await page.getByLabel('Fight mode').selectOption('Practice');
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'tests/fight-mobile.png' });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await page.getByRole('button', { name: 'Start fight', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.fight-input').disabled);
await page.locator('.challenge-card').click();
assert.ok(
  await page.evaluate(() => document.activeElement === document.querySelector('.fight-input')),
);
await page.getByRole('button', { name: 'Block', exact: true }).click();
assert.equal(
  await page.getByRole('button', { name: 'Block', exact: true }).getAttribute('aria-pressed'),
  'true',
);
assert.deepEqual(errors, []);
console.log(
  'PASS: full fight victory, error recovery, pause/resume, combos, persistence, replay, complete racing regression, mobile Practice and stance controls.',
);
await browser.close();
