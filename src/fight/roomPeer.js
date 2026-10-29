import Peer from 'peerjs';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const validRoomCode = (code) => /^[A-HJ-NP-Z2-9]{4}$/.test(code);
function roomCode() {
  return [...crypto.getRandomValues(new Uint8Array(4))].map(n => alphabet[n % alphabet.length]).join('');
}
function namespace() {
  let hash = 2166136261;
  for (const c of location.origin) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `typefight-v2-${(hash >>> 0).toString(36)}-`;
}

// PeerServer only handles discovery/signaling; gameplay stays on the data channel.
export function createRoomPeer({ onOpen, onMessage, onStatus, onError }) {
  let peer, channel, closed = false, timer, registrationTimer, rejectPending, heartbeat, reverseTimer;
  let isHost = false, remotePeer = '', reversed = false;
  let lastPacket = 0;
  const stopTimer = () => clearTimeout(timer);
  function close() {
    if (closed) return;
    closed = true;
    stopTimer();
    clearTimeout(registrationTimer);
    clearInterval(heartbeat);
    clearTimeout(reverseTimer);
    rejectPending?.(Error('Connection cancelled.'));
    rejectPending = null;
    channel?.close();
    peer?.destroy();
  }
  function fail(message) {
    if (closed) return;
    close();
    onError(message);
    onStatus('failed');
  }
  function deadline(ms, message) {
    stopTimer();
    timer = setTimeout(() => fail(message), ms);
  }
  function bind(connection, replacing = false) {
    const expectedReverse = !isHost && !channel?.open && remotePeer === connection.peer && connection.metadata?.reverse === true;
    if (closed || (channel && !replacing && !expectedReverse) || connection.metadata?.app !== 'typefight-v2') {
      connection.close();
      return;
    }
    const previous = channel;
    channel = connection;
    if (isHost) remotePeer = connection.peer;
    previous?.close();
    onStatus(connection.metadata?.reverse ? 'retrying' : 'connecting');
    deadline(30000, 'The direct connection timed out. Keep both game tabs visible and try swapping who creates the room. If that still fails, these networks may need a TURN relay.');
    if (isHost && !reversed) {
      reverseTimer = setTimeout(() => {
        if (closed || channel?.open) return;
        reversed = true;
        bind(peer.connect(remotePeer, {
          reliable: true, serialization: 'json', metadata: { app: 'typefight-v2', reverse: true },
        }), true);
      }, 10000);
    }
    channel.on('open', () => {
      if (closed || channel !== connection) return;
      stopTimer();
      clearTimeout(reverseTimer);
      lastPacket = Date.now();
      heartbeat = setInterval(() => {
        if (Date.now() - lastPacket > 12000) {
          fail('Your friend stopped responding. Create a new room to reconnect.');
          return;
        }
        try { channel.send(JSON.stringify({ type: '__ping' })); }
        catch { fail('The connection was interrupted. Create a new room.'); }
      }, 2000);
      onStatus('connected');
      onOpen();
    });
    channel.on('data', data => {
      if (closed || channel !== connection || typeof data !== 'string' || data.length > 60000) return;
      try {
        const message = JSON.parse(data);
        lastPacket = Date.now();
        if (message?.type === '__ping') channel.send(JSON.stringify({ type: '__pong' }));
        else if (message?.type !== '__pong') onMessage(message);
      } catch { /* Ignore malformed peer packets. */ }
    });
    channel.on('close', () => {
      if (closed || channel !== connection || !lastPacket) return;
      close();
      onStatus('disconnected');
    });
    channel.on('error', () => {
      if (!closed && channel === connection && lastPacket) fail('The connection was interrupted. Create a new room and try again.');
      // Before opening, allow the reverse attempt or the bounded deadline to finish.
    });
  }
  async function register(id) {
    if (closed) throw Error('Connection cancelled.');
    peer = new Peer(id, {
      host: '0.peerjs.com', port: 443, secure: true, path: '/', debug: 0,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });
    const current = peer;
    let registered = false;
    current.on('connection', connection => bind(connection));
    await new Promise((resolve, reject) => {
      rejectPending = reject;
      registrationTimer = setTimeout(() => reject(Error('Room service is not responding. Please try again shortly.')), 15000);
      current.once('open', () => {
        clearTimeout(registrationTimer);
        rejectPending = null;
        registered = true;
        resolve();
      });
      current.on('error', error => {
        clearTimeout(registrationTimer);
        if (closed || current !== peer) return;
        if (error.type === 'webrtc' && channel && !lastPacket) return;
        const message = error.type === 'peer-unavailable'
          ? 'Room not found. Check the four-character code and ask your friend to keep the room open.'
          : 'Room service could not connect. Please try again shortly.';
        if (rejectPending) {
          rejectPending = null;
          reject(Object.assign(Error(message), { type: error.type }));
        } else fail(message);
      });
      current.on('disconnected', () => {
        // An established data channel can survive a signaling-service interruption.
        if (registered && current === peer && !closed && !channel?.open) fail('Connection to the room service was lost. Create a new room.');
      });
    });
  }
  return {
    async host() {
      isHost = true;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = roomCode();
        try { await register(namespace() + code); }
        catch (e) {
          peer?.destroy();
          if (e.type === 'unavailable-id' && !closed) continue;
          throw e;
        }
        if (closed) throw Error('Connection cancelled.');
        onStatus('waiting');
        deadline(300000, 'This room expired after five minutes. Create a new room to try again.');
        return code;
      }
      throw Error('Could not reserve a room. Please try again.');
    },
    async join(code) {
      isHost = false;
      if (!validRoomCode(code)) throw Error('Enter the four-character room code, for example K7MP.');
      await register(undefined);
      if (closed) throw Error('Connection cancelled.');
      remotePeer = namespace() + code;
      bind(peer.connect(remotePeer, {
        reliable: true, serialization: 'json', metadata: { app: 'typefight-v2' },
      }));
      return code;
    },
    send(message) {
      if (!closed && channel?.open && channel.dataChannel?.bufferedAmount < 65536) {
        const data = JSON.stringify(message);
        if (data.length <= 60000) channel.send(data);
      }
    },
    close,
  };
}
