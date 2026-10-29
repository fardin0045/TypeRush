const directServers = [{ urls: 'stun:stun.l.google.com:19302' }];
const headers = { 'Cache-Control': 'no-store, private', 'Vary': 'Origin' };
const reply = (data, status = 200) => Response.json(data, { status, headers });

export async function POST(request) {
  // Reject cross-site browser requests. This is not authentication; configure
  // provider usage alerts and platform rate limits for a public deployment.
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return reply({ error: 'Same-origin request required.' }, 403);
  }
  const key = process.env.TURN_KEY_ID;
  const token = process.env.TURN_KEY_API_TOKEN;
  const meteredDomain = process.env.METERED_TURN_DOMAIN;
  const meteredKey = process.env.METERED_TURN_API_KEY;
  const useMetered = !!(meteredDomain || meteredKey);
  if (useMetered ? !meteredDomain || !meteredKey : !key || !token)
    return reply({ iceServers: directServers, relay: false, reason: 'not-configured' });
  try {
    if (useMetered && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.metered\.live$/i.test(meteredDomain)) throw Error('invalid-domain');
    const upstream = useMetered ? await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredKey)}`, {
      signal: AbortSignal.timeout(8000), redirect: 'error',
    }) : await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(key)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 7200 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw Error('provider-response');
    const data = await upstream.json();
    const servers = useMetered ? data : data.iceServers;
    if (!Array.isArray(servers)) throw Error('invalid-response');
    const iceServers = servers.map(server => {
      const urls = (Array.isArray(server.urls) ? server.urls : [server.urls])
        .filter(url => typeof url === 'string' && /^(stun|turn|turns):[a-z0-9.-]+(?::\d+)?(?:\?transport=(udp|tcp))?$/i.test(url));
      return { urls, ...(typeof server.username === 'string' && typeof server.credential === 'string'
        ? { username: server.username, credential: server.credential } : {}) };
    }).filter(server => server.urls.length);
    if (!iceServers.some(server => server.credential && server.urls.some(url => /^turns?:/.test(url)))) throw Error('missing-relay');
    return reply({ iceServers, relay: true, ...(!useMetered ? { expiresIn: 7200 } : {}) });
  } catch {
    // Never log upstream response bodies, keys or issued credentials.
    console.error('TURN credential generation failed. Check provider configuration and availability.');
    return reply({ iceServers: directServers, relay: false, reason: 'unavailable' });
  }
}
