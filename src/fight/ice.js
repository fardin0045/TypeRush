export async function loadIceConfiguration(signal, forceRelay = false) {
  let data;
  try {
    const response = await fetch('/api/ice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{}', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
    if (!response.ok) throw Error('ICE service unavailable');
    data = await response.json();
  } catch {
    if (signal.aborted) throw Error('Connection cancelled.');
    data = { relay: false, reason: 'unavailable' };
  }
  const valid = Array.isArray(data?.iceServers) && data.iceServers.length > 0 && data.iceServers.every(server => {
    const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
    return urls.length && urls.every(url => typeof url === 'string' && /^(stun|turn|turns):/.test(url));
  });
  const relay = valid && data.relay === true && data.iceServers.some(server =>
    typeof server.username === 'string' && typeof server.credential === 'string' &&
    (Array.isArray(server.urls) ? server.urls : [server.urls]).some(url => /^turns?:/.test(url)));
  if (forceRelay && !relay) throw Error('Relay is not available yet. The website owner must configure TURN on Vercel, then redeploy.');
  return {
    config: {
      iceServers: valid ? data.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
      iceTransportPolicy: forceRelay ? 'relay' : 'all',
    },
    relay: !!relay,
    reason: data?.reason || 'unavailable',
  };
}
