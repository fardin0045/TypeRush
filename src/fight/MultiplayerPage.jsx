import React, { useEffect, useRef, useState } from 'react';
import { createPeer } from './peer.js';
import { versusMatch, snapshot, validSnapshot, applyAction } from './versus.js';
import { advanceMatch, startMatch, pauseMatch } from './combat.js';
import { playCombatTimeline, fightSound } from './fightAudio.js';
import { keyboardClick } from '../audio.js';
import { load } from '../storage.js';
import FightingArena from './FightingArena.jsx';
import './versus.css';
export default function MultiplayerPage() {
  const [, paint] = useState(0),
    [role, setRole] = useState(''),
    [status, setStatus] = useState('idle'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [incoming, setIncoming] = useState(''),
    [outgoing, setOutgoing] = useState(''),
    [level, setLevel] = useState('Normal'),
    [sound, setSound] = useState(() => !!load().sound),
    [reduced, setReduced] = useState(
      () => load().reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  const peer = useRef(null),
    model = useRef(null),
    host = useRef(false),
    connected = useRef(false),
    epoch = useRef(1),
    ready = useRef(false),
    last = useRef(performance.now()),
    received = useRef(0),
    remoteClock = useRef(0),
    input = useRef(null),
    alive = useRef(true),
    prefs = useRef({ sound, reduced }),
    rate = useRef({ at: 0, count: 0 }),
    version = useRef(0);
  model.current ??= versusMatch();
  prefs.current = { sound, reduced };
  function refresh() {
    if (alive.current) paint((v) => v + 1);
  }
  function sendState() {
    peer.current?.send(snapshot(model.current, epoch.current, ready.current));
  }
  function sync() {
    const now = performance.now();
    if (host.current) advanceMatch(model.current, Math.min(0.25, (now - last.current) / 1000));
    last.current = now;
  }
  function connection(value) {
    connected.current = value === 'connected';
    setStatus(value);
    if (['failed', 'disconnected', 'closed'].includes(value)) {
      if (model.current.status !== 'paused') pauseMatch(model.current);
      refresh();
    }
  }
  function receive(m) {
    if (!host.current) {
      if (validSnapshot(m) && m.epoch >= epoch.current) {
        epoch.current = m.epoch;
        ready.current = !!m.ready;
        Object.assign(model.current, m.state);
        received.current = performance.now();
        remoteClock.current = m.state.clock;
        refresh();
      }
      return;
    }
    const now = performance.now();
    if (now - rate.current.at > 1000) rate.current = { at: now, count: 0 };
    if (++rate.current.count > 100) return;
    sync();
    if (
      m?.type === 'ready' &&
      m.epoch === epoch.current &&
      ['ready', 'finished'].includes(model.current.status)
    )
      ready.current = !!m.ready;
    else applyAction(model.current, m, 'enemy', epoch.current);
    sendState();
    refresh();
  }
  async function setup(isHost) {
    setError('');
    setBusy(true);
    peer.current?.close();
    const operation = ++version.current;
    host.current = isHost;
    setRole(isHost ? 'host' : 'guest');
    connected.current = false;
    ready.current = false;
    epoch.current = 1;
    setOutgoing('');
    setStatus('gathering');
    model.current = versusMatch(level);
    last.current = performance.now();
    try {
      const p = createPeer({
        onOpen: () => {
          if (isHost) sendState();
        },
        onMessage: receive,
        onStatus: (value) => {
          if (alive.current && operation === version.current) connection(value);
        },
      });
      peer.current = p;
      const code = isHost ? await p.offer() : await p.answer(incoming);
      if (alive.current && operation === version.current) {
        setOutgoing(code);
        if (isHost) setStatus('invite');
      }
    } catch (e) {
      if (operation === version.current) {
        peer.current?.close();
        setError(e.message);
        setStatus('failed');
      }
    } finally {
      if (alive.current && operation === version.current) setBusy(false);
    }
  }
  async function accept() {
    setError('');
    setBusy(true);
    try {
      await peer.current.accept(incoming);
    } catch (e) {
      setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function action(type, fields = {}) {
    if (!connected.current) return;
    const message = { type, epoch: epoch.current, round: model.current.round, ...fields };
    if (host.current) {
      sync();
      applyAction(model.current, message, 'player', epoch.current);
      sendState();
      refresh();
    } else peer.current?.send(message);
  }
  function type(key) {
    if (model.current.status !== 'fighting') return;
    action('key', { key });
    keyboardClick(prefs.current.sound, key);
  }
  function start() {
    if (!host.current || !connected.current || !ready.current) return;
    sync();
    startMatch(model.current);
    ready.current = false;
    sendState();
    fightSound(sound, 'start');
    refresh();
  }
  function rematch() {
    if (!host.current || !connected.current) return;
    epoch.current++;
    model.current = versusMatch(level);
    ready.current = false;
    last.current = performance.now();
    sendState();
    refresh();
  }
  function leave() {
    version.current++;
    peer.current?.close();
    peer.current = null;
    connected.current = false;
    setRole('');
    setStatus('idle');
    setOutgoing('');
    setIncoming('');
    setError('');
    setBusy(false);
    model.current = versusMatch(level);
    refresh();
  }
  useEffect(() => {
    alive.current = true;
    let frame,
      lastPaint = 0,
      lastSent = 0;
    function tick(now) {
      if (connected.current) {
        if (host.current) {
          sync();
          if (now - lastSent > 33) {
            sendState();
            lastSent = now;
          }
        } else if (!['ready', 'paused', 'finished'].includes(model.current.status))
          model.current.clock =
            remoteClock.current + Math.min(0.08, (now - received.current) / 1000);
        playCombatTimeline(model.current, prefs.current.sound);
        if (now - lastPaint > 33) {
          refresh();
          lastPaint = now;
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    function hide() {
      if (document.hidden && connected.current) action('pause', { paused: true });
    }
    document.addEventListener('visibilitychange', hide);
    return () => {
      alive.current = false;
      version.current++;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', hide);
      peer.current?.close();
    };
  }, []);
  const s = model.current,
    side = role === 'host' ? 'player' : 'enemy',
    local = s[side];
  useEffect(() => {
    if (s.status === 'fighting') input.current?.focus({ preventScroll: true });
  }, [s.status, s.round, role]);
  const playing = ['countdown', 'fighting', 'attack', 'recovery', 'paused'].includes(s.status);
  return (
    <main className="versus-page">
      <nav>
        <a href="#/fight">← Solo TypeFight</a>
        <strong>
          type<span>fight</span> / FRIEND MATCH
        </strong>
        <a href="#/games">Games</a>
      </nav>
      {!role || !connected.current ? (
        <section className="peer-lobby">
          <p className="eyebrow">TWO KEYBOARDS. ONE ARENA.</p>
          <h1>Fight a friend.</h1>
          <p>
            Open this page on both devices. Exchange the invite and reply codes using your usual
            messaging app. Keep both tabs open.
          </p>
          {!role && (
            <>
              <label>
                Word difficulty
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  {['Easy', 'Normal', 'Hard', 'Expert'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <button disabled={busy} onClick={() => setup(true)}>
                Create invite
              </button>
            </>
          )}
          {role === 'host' && <h2>1. Send your invite · 2. Paste their reply</h2>}
          {role === 'guest' && <h2>Send your reply back to the host</h2>}
          {outgoing && (
            <>
              <label>
                {role === 'host' ? 'Your invite code' : 'Your reply code'}
                <textarea readOnly value={outgoing} onFocus={(e) => e.target.select()} />
              </label>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(outgoing);
                  } catch {
                    setError('Select the code above and copy it manually.');
                  }
                }}
              >
                Copy code
              </button>
            </>
          )}
          {role !== 'guest' && (
            <>
              <label>
                {role === 'host' ? 'Friend’s reply code' : 'Or paste an invite code'}
                <textarea
                  value={incoming}
                  maxLength={100000}
                  onChange={(e) => setIncoming(e.target.value)}
                  placeholder={role === 'host' ? 'Paste reply here' : 'Paste invite here'}
                />
              </label>
              <button
                disabled={busy || !incoming.trim()}
                onClick={() => (role === 'host' ? accept() : setup(false))}
              >
                {role === 'host' ? 'Connect to friend' : 'Join with invite'}
              </button>
            </>
          )}
          <p role="status">
            {busy
              ? 'Preparing your connection…'
              : status === 'connecting'
                ? 'Connecting to your friend…'
                : status === 'invite'
                  ? 'Invite ready. Waiting for their reply.'
                  : status === 'failed' || status === 'disconnected'
                    ? 'Connection unavailable. Try the same Wi-Fi or a different network, then create new codes.'
                    : role === 'guest'
                      ? 'Waiting for the host to accept your reply…'
                      : ''}
          </p>
          {error && <p role="alert">{error}</p>}
          {role && (
            <button className="secondary" onClick={leave}>
              Start over
            </button>
          )}
          <small>
            No account or database. Public STUN helps browsers find each other; restrictive networks
            may block a direct connection. Share codes only with your intended opponent.
          </small>
        </section>
      ) : (
        <>
          <div className="peer-toolbar">
            <span className="peer-connected">
              ● Connected · You are {role === 'host' ? 'Host (blue)' : 'Friend (pink)'}
            </span>
            <label>
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => {
                  setSound(e.target.checked);
                  fightSound(e.target.checked, 'start');
                }}
              />{' '}
              Sound
            </label>
            <label>
              <input
                type="checkbox"
                checked={reduced}
                onChange={(e) => setReduced(e.target.checked)}
              />{' '}
              Reduce motion
            </label>
            <button onClick={leave}>Leave match</button>
          </div>
          <section className="peer-arena">
            <header>
              {['player', 'enemy'].map((who) => (
                <div key={who} className={who}>
                  <strong>
                    {who === 'player' ? 'HOST' : 'FRIEND'} {who === side ? '· YOU' : ''}
                    <b>{s[who].hp} HP</b>
                  </strong>
                  <progress max="100" value={s[who].hp} />
                  <small>
                    {s[who].cursor} / {s.word.length} characters
                  </small>
                </div>
              ))}
            </header>
            <FightingArena match={s} reduced={reduced} />
            {s.status === 'countdown' && (
              <div className="peer-announcement">
                {Math.max(1, Math.ceil(s.phaseEnd - s.clock))}
              </div>
            )}
            {s.status === 'ready' && (
              <div className="peer-announcement">
                <h2>{role === 'host' ? 'Ready for a real rival?' : 'Ready to fight?'}</h2>
                {role === 'guest' ? (
                  <button
                    disabled={ready.current}
                    onClick={() =>
                      peer.current.send({ type: 'ready', epoch: epoch.current, ready: true })
                    }
                  >
                    {ready.current ? 'Waiting for host…' : 'I’m ready'}
                  </button>
                ) : (
                  <button disabled={!ready.current} onClick={start}>
                    {ready.current ? 'Start match' : 'Waiting for friend to get ready…'}
                  </button>
                )}
              </div>
            )}
            {s.status === 'paused' && (
              <div className="peer-announcement">
                <h2>Match paused</h2>
                <button onClick={() => action('pause', { paused: false })}>Resume match</button>
              </div>
            )}
            {s.status === 'finished' && (
              <div className="peer-announcement" role="status">
                <h2>{s.winner === side ? 'You win!' : 'Your friend wins!'}</h2>
                {role === 'host' ? (
                  <button onClick={rematch}>New match</button>
                ) : (
                  <p>Waiting for the host to offer a rematch.</p>
                )}
              </div>
            )}
            {playing && (
              <div className="peer-word" onClick={() => input.current?.focus()}>
                <span className="eyebrow">CORRECT LETTER → PUNCH · COMPLETE WORD → KICK</span>
                <div aria-label="Multiplayer typing challenge">
                  {[...s.word].map((c, i) => (
                    <span
                      key={i}
                      className={
                        i < local.cursor
                          ? 'correct'
                          : i === local.cursor
                            ? local.wrong
                              ? 'wrong'
                              : 'current'
                            : ''
                      }
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <input
                  ref={input}
                  aria-label="Type the multiplayer word"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value=""
                  disabled={s.status !== 'fighting'}
                  onPaste={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      action('pause', { paused: s.status !== 'paused' });
                    } else if (
                      !e.ctrlKey &&
                      !e.metaKey &&
                      !e.altKey &&
                      (e.key.length === 1 || e.key === 'Backspace')
                    ) {
                      e.preventDefault();
                      if (!e.repeat) type(e.key);
                    }
                  }}
                  onBeforeInput={(e) => {
                    e.preventDefault();
                    const v = e.nativeEvent;
                    if (v.inputType === 'deleteContentBackward') type('Backspace');
                    else if (v.inputType === 'insertText' && v.data?.length === 1) type(v.data);
                  }}
                  onChange={() => {}}
                />
                <small>
                  {local.wrong
                    ? 'Press Backspace to fix the mistake.'
                    : 'Click here and type. One word at a time.'}
                </small>
              </div>
            )}
          </section>
          <div className="peer-toolbar">
            {['attack', 'block', 'dodge'].map((stance) => (
              <button
                key={stance}
                disabled={s.status !== 'fighting'}
                aria-pressed={local.stance === stance}
                onClick={() => action('stance', { stance })}
              >
                {stance}
              </button>
            ))}
            <button
              disabled={!playing}
              onClick={() => action('pause', { paused: s.status !== 'paused' })}
            >
              {s.status === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <small>Friendly match · the host runs the game. Keep both tabs visible.</small>
          </div>
        </>
      )}
    </main>
  );
}
