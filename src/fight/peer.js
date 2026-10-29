// Manual SDP exchange: no application signaling server or stored rooms.
export function decodeCode(code, type) {
  if (typeof code !== 'string' || code.length > 100000) throw Error('Invalid connection code.');
  try {
    const value = JSON.parse(atob(code.trim().replace(/\s/g, '')));
    if (
      value.v !== 1 ||
      value.type !== type ||
      typeof value.sdp !== 'string' ||
      !value.sdp.startsWith('v=0') ||
      value.sdp.length > 60000
    )
      throw Error();
    return { type: value.type, sdp: value.sdp };
  } catch {
    throw Error(`Paste a valid TypeFight ${type === 'offer' ? 'invite' : 'reply'} code.`);
  }
}
export function createPeer({ onOpen, onMessage, onStatus }) {
  if (!globalThis.RTCPeerConnection)
    throw Error(
      'This browser does not support direct multiplayer. Try a current Chrome, Edge or Firefox browser.',
    );
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  let channel,
    closed = false,
    timeout;
  function bind(dc) {
    if (channel) {
      dc.close();
      return;
    }
    channel = dc;
    dc.onopen = () => {
      if (closed) return;
      clearTimeout(timeout);
      onStatus('connected');
      onOpen();
    };
    dc.onclose = () => {
      if (!closed) onStatus('disconnected');
    };
    dc.onerror = () => {
      if (!closed) onStatus('failed');
    };
    dc.onmessage = (e) => {
      if (closed || typeof e.data !== 'string' || e.data.length > 60000) return;
      try {
        onMessage(JSON.parse(e.data));
      } catch {}
    };
  }
  pc.ondatachannel = (e) => bind(e.channel);
  pc.onconnectionstatechange = () => {
    if (!closed && ['failed', 'disconnected', 'closed'].includes(pc.connectionState))
      onStatus(pc.connectionState);
  };
  async function code() {
    if (pc.iceGatheringState !== 'complete')
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pc.removeEventListener('icegatheringstatechange', check);
          closed ? reject(Error('Connection closed.')) : resolve();
        }, 6000);
        function check() {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timer);
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        }
        pc.addEventListener('icegatheringstatechange', check);
        check();
      });
    if (closed) throw Error('Connection closed.');
    return btoa(
      JSON.stringify({ v: 1, type: pc.localDescription.type, sdp: pc.localDescription.sdp }),
    );
  }
  function connecting() {
    if (channel?.readyState === 'open') return;
    onStatus('connecting');
    clearTimeout(timeout);
    timeout = setTimeout(() => onStatus('failed'), 25000);
  }
  return {
    async offer() {
      bind(pc.createDataChannel('typefight', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      return code();
    },
    async answer(invite) {
      await pc.setRemoteDescription(decodeCode(invite, 'offer'));
      await pc.setLocalDescription(await pc.createAnswer());
      const reply = await code();
      onStatus('connecting');
      return reply;
    },
    async accept(reply) {
      await pc.setRemoteDescription(decodeCode(reply, 'answer'));
      connecting();
    },
    send(message) {
      if (channel?.readyState === 'open' && channel.bufferedAmount < 65536)
        channel.send(JSON.stringify(message));
    },
    close() {
      closed = true;
      clearTimeout(timeout);
      channel?.close();
      pc.close();
    },
  };
}
