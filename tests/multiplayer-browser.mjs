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
  await guest.getByLabel('Enter room code').fill('AB');
  assert.ok(await guest.getByRole('button', { name: 'Join room', exact: true }).isDisabled());
  await host.getByLabel('Word difficulty').selectOption('Easy');
  await host.getByRole('button', { name: 'Create room', exact: true }).click();
  await host.getByLabel('Your room code').waitFor({ timeout: 20000 });
  const code = await host.getByLabel('Your room code').inputValue();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/);
  await host.screenshot({ path: 'tests/room-code.png' });
  await guest.getByLabel('Enter room code').fill(code.toLowerCase());
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await guest.waitForFunction(() => document.querySelector('.peer-word input') && !document.querySelector('.peer-word input').disabled);
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
  await guest.waitForFunction(() => document.querySelector('.peer-word input') && !document.querySelector('.peer-word input').disabled);
  await host.close();
  await guest.getByRole('button', { name: 'Start over' }).waitFor();
  // Swap roles: the mobile-sized former guest now hosts. Simulate a stalled
  // initial offer to prove that the opposite connection direction recovers.
  await guest.addInitScript(() => {
    const original = RTCPeerConnection.prototype.setRemoteDescription;
    window.blockedInitialOffer = false;
    RTCPeerConnection.prototype.setRemoteDescription = function(description) {
      if (description.type === 'offer' && !window.blockedInitialOffer) {
        window.blockedInitialOffer = true;
        return new Promise(() => {});
      }
      return original.call(this, description);
    };
  });
  await guest.reload();
  const formerHost = await a.newPage();
  formerHost.on('pageerror', e => errors.push(e.message));
  await formerHost.goto('http://127.0.0.1:5177/#/fight/friend');
  await guest.getByRole('button', { name: 'Create room', exact: true }).click();
  const reversedCode = await guest.getByLabel('Your room code').inputValue({ timeout: 20000 });
  await formerHost.getByLabel('Enter room code').fill(reversedCode);
  await formerHost.getByRole('button', { name: 'Join room', exact: true }).click();
  await formerHost.waitForFunction(() => document.querySelector('.peer-word input') && !document.querySelector('.peer-word input').disabled, null, { timeout: 45000 });
  assert.equal(await guest.evaluate(() => window.blockedInitialOffer), true);
  assert.ok((await guest.locator('.peer-connected').innerText()).includes('Host'));
  assert.ok((await formerHost.locator('.peer-connected').innerText()).includes('Friend'));
  const reverseWord = await formerHost.getByLabel('Multiplayer typing challenge').innerText();
  await formerHost.getByLabel('Type the multiplayer word').press(reverseWord[0]);
  await guest.waitForFunction(() => document.querySelector('.peer-arena .enemy small').textContent.startsWith('1 /'));
  await guest.getByRole('button', { name: 'Leave match' }).click();
  await formerHost.getByRole('button', { name: 'Start over' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: real room joining, automatic start, full match, rematch, disconnect, mobile hosting, and reverse-direction recovery after a deliberately stalled initial offer.',
  );
} finally {
  await browser.close();
}
