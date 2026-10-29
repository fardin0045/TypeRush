import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { POST as iceCredentials } from '../api/ice.js';
const root = resolve('dist');
const headerText = await readFile(resolve(root, '_headers'), 'utf8');
const headers = {};
// Apply the global Cloudflare headers to the local built-site test as well.
for (const line of headerText.split(/\r?\n/).slice(1)) {
  if (!line.startsWith('  ')) break;
  const split = line.indexOf(':');
  if (split > 0) headers[line.slice(0, split).trim()] = line.slice(split + 1).trim();
}
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.md': 'text/plain',
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api/ice' && req.method === 'POST') {
      const response = await iceCredentials(new Request('http://127.0.0.1:5177/api/ice', {
        method: 'POST', headers: { origin: req.headers.origin || '' },
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw Error();
    res.writeHead(200, {
      ...headers,
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise((r) => server.listen(5177, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(!process.env.CI ? { channel: 'chrome' } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error('CSP ' + e.violatedDirective),
    ),
  );
  const response = await page.goto('http://127.0.0.1:5177/#/games');
  assert.equal(response.status(), 200);
  assert.ok(response.headers()['content-security-policy']);
  await page.getByRole('heading', { name: 'Choose your kind of fast.' }).waitFor();
  for (let i = 1; i <= 8; i++)
    assert.equal((await page.request.get(`http://127.0.0.1:5177/audio/mechanical/key-${i}.wav`)).status(), 200);
  await page.goto('http://127.0.0.1:5177/#/fight');
  await page.getByLabel('Fight mode').selectOption('Practice');
  await page.getByRole('button', { name: 'Start fight', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.fight-input').disabled);
  await page.keyboard.type(
    await page.getByLabel('Fight typing challenge', { exact: true }).innerText(),
  );
  await page.waitForFunction(() => !document.querySelector('.fight-input').disabled);
  await page.reload();
  await page.getByRole('button', { name: 'Start fight', exact: true }).waitFor();
  await page.goto('http://127.0.0.1:5177/#/race');
  await page.getByRole('button', { name: 'Start race', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.input-row input').disabled);
  await page.keyboard.type(await page.getByLabel('Typing passage', { exact: true }).innerText());
  await page.getByRole('dialog', { name: 'Race results' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5177/#/fight');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => localStorage.setItem('typerush.v1', '{broken'));
  await page.reload();
  await page.getByRole('button', { name: 'Start fight', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await import('./race-effects-browser.mjs');
  await import('./multiplayer-browser.mjs');
  console.log(
    'PASS: production assets and CSP, route refresh, fight input, complete race, mobile layout, corrupt-storage recovery.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
