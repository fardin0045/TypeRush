import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5177');
await page.getByRole('heading', { name: 'Find your fast.' }).waitFor();
await page.screenshot({ path: 'tests/desktop.png', fullPage: true });
await page.getByLabel('Difficulty', { exact: true }).selectOption('Easy');
const passage = await page.getByLabel('Typing passage', { exact: true }).innerText();
await page.getByRole('button', { name: 'Start race', exact: true }).click();
const input = page.getByRole('textbox', { name: 'Type the passage here' });
await input.waitFor();
await page.waitForFunction(
  () => !document.querySelector('input[aria-label="Type the passage here"]').disabled,
);
await input.press('~');
assert.equal(await page.locator('.lane-progress').first().innerText(), '0%');
await input.press('Backspace');
await input.pressSequentially(passage, { delay: 30 });
console.log('Typed passage:', await page.locator('.hud').innerText(), await input.inputValue());
await page.getByRole('dialog', { name: 'Race results' }).waitFor();
assert.match(await page.locator('.result-details').innerText(), /1 errors/);
assert.ok(
  await page
    .locator('.podium')
    .innerText()
    .then((t) => t.includes('1st · YOU')),
);
await page.screenshot({ path: 'tests/results.png', fullPage: true });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('typerush.v1')));
assert.equal(saved.completed, 1);
assert.equal(saved.wins, 1);
await page.reload();
assert.equal(await page.locator('.personal strong').innerText(), `${Math.round(saved.best)} WPM`);
await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
assert.ok(
  await page
    .locator('.history')
    .innerText()
    .then((t) => t.includes('Quick race')),
);
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.getByRole('button', { name: 'Start race', exact: true }).click();
await page.waitForFunction(
  () => !document.querySelector('input[aria-label="Type the passage here"]').disabled,
);
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Resume race' }).waitFor();
await page.getByRole('button', { name: 'Resume race' }).click();
await page.getByRole('button', { name: 'Pause race' }).waitFor();
await page.reload();
await page.getByRole('button', { name: 'Time trial', exact: true }).click();
await page.getByLabel('Trial duration').selectOption('15');
await page.getByRole('button', { name: 'Start race', exact: true }).click();
await page.getByRole('dialog', { name: 'Race results' }).waitFor({ timeout: 25000 });
assert.match(await page.locator('.result-metrics').innerText(), /15.0s/);
await page.reload();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'tests/mobile.png', fullPage: true });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await page.getByRole('button', { name: 'Start race', exact: true }).click();
await page.waitForFunction(
  () => !document.querySelector('input[aria-label="Type the passage here"]').disabled,
);
await input.pressSequentially('x');
assert.equal(errors.length, 0, errors.join('\n'));
console.log(
  'PASS: full player win, mistake recovery, results, persistence, restart, pause/resume, timed finish, mobile layout; no browser errors.',
);
await browser.close();
