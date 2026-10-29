import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../api/ice.js';
import { loadIceConfiguration } from '../src/fight/ice.js';

const request = (origin = 'https://game.example') => new Request('https://game.example/api/ice', { method: 'POST', headers: { origin } });
const servers = [{ urls: ['turns:turn.cloudflare.com:443?transport=tcp'], username: 'temporary-user', credential: 'temporary-credential' }];
function credentials(t, enabled = true) {
  const meteredPrevious = [process.env.METERED_TURN_DOMAIN, process.env.METERED_TURN_API_KEY];
  delete process.env.METERED_TURN_DOMAIN;
  delete process.env.METERED_TURN_API_KEY;
  t.after(() => {
    for (const [index, name] of ['METERED_TURN_DOMAIN', 'METERED_TURN_API_KEY'].entries()) {
      if (meteredPrevious[index] === undefined) delete process.env[name]; else process.env[name] = meteredPrevious[index];
    }
  });
  const previous = [process.env.TURN_KEY_ID, process.env.TURN_KEY_API_TOKEN];
  if (enabled) { process.env.TURN_KEY_ID = 'test-id'; process.env.TURN_KEY_API_TOKEN = 'private-test-secret'; }
  else { delete process.env.TURN_KEY_ID; delete process.env.TURN_KEY_API_TOKEN; }
  t.after(() => {
    for (const [index, name] of ['TURN_KEY_ID', 'TURN_KEY_API_TOKEN'].entries()) {
      if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index];
    }
  });
}
test('TURN endpoint rejects cross-origin browser requests before requesting credentials', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw Error('Must not call'); });
  assert.equal((await POST(request('https://other.example'))).status, 403);
  assert.equal(fetch.mock.callCount(), 0);
});
test('unconfigured relay reports direct-only without breaking existing connections', async t => {
  credentials(t, false);
  const response = await POST(request());
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  const result = await response.json();
  assert.equal(result.relay, false);
  assert.equal(result.reason, 'not-configured');
});
test('TURN endpoint issues temporary credentials without exposing the long-term secret', async t => {
  credentials(t);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://rtc.live.cloudflare.com/v1/turn/keys/test-id/credentials/generate-ice-servers');
    assert.equal(options.headers.Authorization, 'Bearer private-test-secret');
    assert.deepEqual(JSON.parse(options.body), { ttl: 7200 });
    return Response.json({ iceServers: servers, extraSecret: 'do-not-return' });
  });
  const text = await (await POST(request())).text();
  assert.equal(JSON.parse(text).relay, true);
  assert.ok(!text.includes('private-test-secret') && !text.includes('do-not-return'));
});
test('provider errors fall back safely without leaking the response', async t => {
  credentials(t);
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response('sensitive provider diagnostic', { status: 401 }));
  const text = await (await POST(request())).text();
  assert.equal(JSON.parse(text).reason, 'unavailable');
  assert.ok(!text.includes('sensitive'));
});
test('client supplies authenticated TURN URLs and can force relay transport', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ relay: true, iceServers: servers }));
  const result = await loadIceConfiguration(new AbortController().signal, true);
  assert.equal(result.relay, true);
  assert.equal(result.config.iceTransportPolicy, 'relay');
  assert.deepEqual(result.config.iceServers, servers);
});
test('client rejects relay-only mode without working relay credentials', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ relay: false, reason: 'not-configured' }));
  await assert.rejects(loadIceConfiguration(new AbortController().signal, true), /configure TURN/);
  const direct = await loadIceConfiguration(new AbortController().signal);
  assert.equal(direct.relay, false);
  assert.equal(direct.config.iceTransportPolicy, 'all');
});
test('Metered credentials are fetched server-side and API key is not returned', async t => {
  credentials(t, false);
  process.env.METERED_TURN_DOMAIN = 'typefight.metered.live';
  process.env.METERED_TURN_API_KEY = 'private-metered-key';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://typefight.metered.live/api/v1/turn/credentials?apiKey=private-metered-key');
    assert.equal(options.redirect, 'error');
    return Response.json(servers);
  });
  const text = await (await POST(request())).text();
  assert.equal(JSON.parse(text).relay, true);
  assert.ok(!text.includes('private-metered-key'));
});
test('Metered configuration cannot send the API key to an arbitrary host', async t => {
  credentials(t, false);
  process.env.METERED_TURN_DOMAIN = 'attacker.example';
  process.env.METERED_TURN_API_KEY = 'private-metered-key';
  t.mock.method(console, 'error', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw Error('Must not call'); });
  assert.equal((await (await POST(request())).json()).relay, false);
  assert.equal(fetch.mock.callCount(), 0);
});
