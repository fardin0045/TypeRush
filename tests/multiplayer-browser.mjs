import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, ...(!process.env.CI ? {channel:'chrome'} : {}) });
try {
  const a = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await a.newPage(),
    guest = await b.newPage(),
    errors = [];
  for (const p of [host, guest]) {
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.goto('http://127.0.0.1:5177/#/fight/friend');
  }
  await guest.getByLabel('Or paste an invite code').fill('invalid');
  await guest.getByRole('button', { name: 'Join with invite' }).click();
  await guest.getByRole('alert').waitFor();
  await guest.getByRole('button', { name: 'Start over' }).click();
  await host.getByLabel('Word difficulty').selectOption('Easy');
  await host.getByRole('button', { name: 'Create invite' }).click();
  await host.getByLabel('Your invite code').waitFor();
  const invite = await host.getByLabel('Your invite code').inputValue();
  await guest.getByLabel('Or paste an invite code').fill(invite);
  await guest.getByRole('button', { name: 'Join with invite' }).click();
  await guest.getByLabel('Your reply code').waitFor();
  const reply = await guest.getByLabel('Your reply code').inputValue();
  await host.getByLabel('Friend’s reply code').fill(reply);
  await host.getByRole('button', { name: 'Connect to friend' }).click();
  await guest.getByRole('button', { name: 'I’m ready' }).waitFor();
  await guest.getByRole('button', { name: 'I’m ready' }).click();
  await host.getByRole('button', { name: 'Start match' }).click();
  await guest.waitForFunction(() => !document.querySelector('.peer-word input').disabled);
  assert.equal(
    await guest.getByLabel('Multiplayer typing challenge').innerText(),
    await host.getByLabel('Multiplayer typing challenge').innerText(),
  );
  await guest.getByLabel('Type the multiplayer word').press('x');
  await guest.waitForTimeout(150); // wrong character unless word begins x (Easy never does)
  assert.equal(await guest.locator('.peer-word .wrong').count(), 1);
  await guest.getByLabel('Type the multiplayer word').press('Backspace');
  await guest.getByRole('button', { name: 'Pause', exact: true }).click();
  await host.getByRole('heading', { name: 'Match paused' }).waitFor();
  await guest.getByRole('button', { name: 'Resume match' }).click();
  await host.getByRole('heading', { name: 'Match paused' }).waitFor({ state: 'hidden' });
  await host.screenshot({ path: 'tests/peer-desktop.png' });
  await guest.screenshot({ path: 'tests/peer-mobile.png' });
  assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (let i = 0; i < 15; i++) {
    if (await guest.getByRole('heading', { name: 'You win!' }).count()) break;
    await guest.waitForFunction(
      () =>
        document.querySelector('.peer-announcement h2')?.textContent === 'You win!' ||
        !document.querySelector('.peer-word input')?.disabled,
    );
    if (await guest.getByRole('heading', { name: 'You win!' }).count()) break;
    await guest
      .getByLabel('Type the multiplayer word')
      .pressSequentially(await guest.getByLabel('Multiplayer typing challenge').innerText(), {
        delay: 10,
      });
    await guest.waitForFunction(
      () =>
        document.querySelector('.peer-word input')?.disabled ||
        document.querySelector('.peer-announcement h2')?.textContent === 'You win!',
    );
  }
  await guest.getByRole('heading', { name: 'You win!' }).waitFor();
  await host.getByRole('heading', { name: 'Your friend wins!' }).waitFor();
  await host.getByRole('button', { name: 'New match' }).click();
  await guest.getByRole('button', { name: 'I’m ready' }).waitFor();
  await host.close();
  await guest.getByRole('button', { name: 'Start over' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: real manual WebRTC code exchange, validation, synchronized words, remote punches/kicks, corrections, pause/resume, guest victory, rematch, disconnect and mobile layout.',
  );
} finally {
  await browser.close();
}
