import React, { useEffect, useRef, useState } from 'react';
import {
  Flag,
  ArrowUpRight,
  Volume2,
  VolumeX,
  Settings2,
  Zap,
  RotateCcw,
  Shuffle,
  ArrowRight,
  Trophy,
  Keyboard,
  Timer,
  Target,
  X,
  Play,
  Pause,
} from 'lucide-react';
import ResultsTable from './ResultsTable.jsx';
import RaceTrack, { RacingCar, colors } from './Track.jsx';
import {
  createRace,
  inputCharacter,
  tick,
  metrics,
  standings,
  pickPassage,
  difficulties,
} from './engine.js';
import { load, save } from './storage.js';
import { sound, keyboardClick } from './audio.js';
const modes = ['Quick race', 'Practice', 'Time trial', 'Challenge', 'Custom race'];
const ordinal = (n) => ['1st', '2nd', '3rd', '4th'][n - 1];
export default function App() {
  const [stored, setStored] = useState(load),
    [difficulty, setDifficulty] = useState(() => load().difficulty || 'Normal');
  const [soundOn, setSoundOn] = useState(() => load().sound || false),
    [reduced, setReduced] = useState(
      () => load().reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  const [mode, setMode] = useState('Quick race'),
    [duration, setDuration] = useState(30),
    [length, setLength] = useState('Medium'),
    [index, setIndex] = useState(() => Math.floor(Math.random() * 4));
  const [modal, setModal] = useState(null),
    [count, setCount] = useState(null),
    [, render] = useState(0),
    [storageError, setStorageError] = useState(false);
  const passage = pickPassage(index, difficulty, length),
    raceRef = useRef(createRace(passage.text, difficulty)),
    inputRef = useRef(null),
    countTimer = useRef(),
    last = useRef(0),
    saved = useRef(false),
    settings = useRef({ soundOn });
  settings.current = { soundOn };
  const race = raceRef.current,
    m = metrics(race),
    rank = standings(race).findIndex((x) => x.name === 'YOU') + 1;
  const active = ['racing', 'countdown', 'paused'].includes(race.status);
  function persist(next) {
    setStored(next);
    setStorageError(!save(next));
  }
  useEffect(() => {
    const next = { ...load(), difficulty, sound: soundOn, reduced };
    setStorageError(!save(next));
  }, [difficulty, soundOn, reduced]);
  function reset(
    nextMode = mode,
    nextDifficulty = difficulty,
    nextIndex = index,
    nextLength = length,
  ) {
    clearInterval(countTimer.current);
    setCount(null);
    saved.current = false;
    raceRef.current = createRace(
      pickPassage(nextIndex, nextDifficulty, nextLength).text,
      nextDifficulty,
      nextIndex + 7,
      nextMode,
      duration,
    );
    render((v) => v + 1);
  }
  useEffect(() => {
    reset(mode, difficulty, index, length);
  }, [mode, difficulty, index, length, duration]);
  function start() {
    if (['racing', 'countdown'].includes(raceRef.current.status)) return;
    reset();
    raceRef.current.status = 'countdown';
    setCount(3);
    sound(soundOn, 420);
    let n = 3;
    countTimer.current = setInterval(() => {
      n--;
      setCount(n);
      sound(settings.current.soundOn, n ? 420 : 840);
      if (n === 0) {
        clearInterval(countTimer.current);
        raceRef.current.status = 'racing';
        last.current = performance.now();
        inputRef.current?.focus();
        setTimeout(() => setCount(null), 400);
      }
    }, 1000);
  }
  function record() {
    if (saved.current) return;
    saved.current = true;
    const s = raceRef.current,
      mm = metrics(s),
      position = standings(s).findIndex((x) => x.name === 'YOU') + 1,
      old = load();
    const result = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      mode: s.mode,
      difficulty: s.difficulty,
      net: Math.round(mm.net),
      accuracy: Math.round(mm.accuracy),
      position,
      time: s.elapsed,
    };
    const competitive = !['Practice', 'Time trial'].includes(s.mode);
    persist({
      ...old,
      best: Math.max(old.best || 0, mm.net),
      accuracy: Math.max(old.accuracy || 0, mm.accuracy),
      completed: (old.completed || 0) + 1,
      wins: (old.wins || 0) + (competitive && position === 1 ? 1 : 0),
      losses: (old.losses || 0) + (competitive && position !== 1 ? 1 : 0),
      history: [result, ...(old.history || [])].slice(0, 30),
    });
    sound(settings.current.soundOn, position === 1 ? 880 : 220, 0.4);
  }
  useEffect(() => {
    let frame,
      paint = 0;
    const loop = (now) => {
      const s = raceRef.current;
      if (s.status === 'racing') {
        tick(s, Math.max(0, (now - last.current) / 1000));
        if (s.status === 'finished') {
          record();
          render((v) => v + 1);
        } else if (now - paint > 50) {
          render((v) => v + 1);
          paint = now;
        }
      }
      last.current = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const visibility = () => {
      if (document.hidden && raceRef.current.status === 'racing') {
        raceRef.current.status = 'paused';
        render((v) => v + 1);
      }
      if (document.hidden && raceRef.current.status === 'countdown') {
        clearInterval(countTimer.current);
        setCount(null);
        raceRef.current.status = 'ready';
        render((v) => v + 1);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(countTimer.current);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  function type(char) {
    const s = raceRef.current;
    if (s.status === 'racing') {
      const now = performance.now();
      tick(s, Math.max(0, (now - last.current) / 1000));
      last.current = now;
    }
    inputCharacter(s, char);
    if (s.mode === 'Time trial' && s.cursor === s.text.length)
      s.text += ' ' + pickPassage(index + 1, difficulty).text;
    if (s.status === 'finished') record();
    keyboardClick(soundOn, char);
    render((v) => v + 1);
  }
  function pause() {
    race.status = race.status === 'paused' ? 'racing' : 'paused';
    last.current = performance.now();
    render((v) => v + 1);
    inputRef.current?.focus();
  }
  useEffect(() => {
    const directTyping = (event) => {
      if (modal || raceRef.current.status !== 'racing' ||
          event.target.closest?.('input,textarea,select,button,a,[contenteditable="true"]')) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (event.key === 'Backspace' || event.key.length === 1) {
        event.preventDefault();
        if (!event.repeat) type(event.key);
        inputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', directTyping);
    return () => window.removeEventListener('keydown', directTyping);
  }, [modal, soundOn, index, difficulty]);
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape' && ['racing', 'paused'].includes(raceRef.current.status)) {
        e.preventDefault();
        raceRef.current.status = raceRef.current.status === 'racing' ? 'paused' : 'racing';
        last.current = performance.now();
        inputRef.current?.focus();
        render((v) => v + 1);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  function changeMode(value) {
    setMode(value);
    setModal(null);
    reset(value);
  }
  const results = race.status === 'finished';
  useEffect(() => {
    if (race.status === 'racing') inputRef.current?.focus();
  }, [race.status]);
  useEffect(() => {
    const current = document.querySelector('.passage .current'),
      panel = current?.parentElement;
    if (current && panel) {
      const y = current.offsetTop;
      if (y < panel.scrollTop || y > panel.scrollTop + panel.clientHeight - 40)
        panel.scrollTop = Math.max(0, y - 40);
    }
  }, [race.cursor]);
  useEffect(() => {
    if (!modal && !results) return;
    const dialog = document.querySelector('[role=dialog]');
    const previous = document.activeElement;
    dialog?.querySelector('button')?.focus();
    const trap = (e) => {
      if (e.key === 'Escape' && modal) {
        setModal(null);
        e.stopImmediatePropagation();
      }
      if (e.key === 'Tab') {
        const nodes = [
          ...dialog.querySelectorAll(
            'button:not(:disabled),select:not(:disabled),input:not(:disabled)',
          ),
        ];
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', trap, true);
    return () => {
      document.removeEventListener('keydown', trap, true);
      previous?.focus();
    };
  }, [modal, results]);
  return (
    <div className={reduced ? 'app reduce-motion' : 'app'}>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            reset();
          }}
        >
          <span className="brand-icon">
            <Zap size={23} fill="currentColor" />
          </span>
          type<span>rush</span>
          <small> / </small>
        </a>
        <nav aria-label="Main navigation">
          <a className="game-nav-link" href="#/games">Games</a>
          <a className="game-nav-link" href="#/fight">TypeFight</a>
          <button
            onClick={() => {
              reset();
              setModal('home');
            }}
          >
            Home
          </button>
          <button
            className={mode === 'Practice' ? 'selected' : ''}
            onClick={() => changeMode('Practice')}
          >
            Practice
          </button>
          <button
            className={mode !== 'Practice' ? 'selected' : ''}
            onClick={() => changeMode('Quick race')}
          >
            Race <span className="nav-dot" />
          </button>
          <button onClick={() => setModal('stats')}>Leaderboard</button>
        </nav>
        <div className="header-tools">
          <span className="guest">
            <i /> GUEST DRIVER
          </span>
          <button
            className="icon-button"
            aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
            onClick={() => {
              setSoundOn(!soundOn);
              sound(!soundOn);
            }}
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label="Settings"
            onClick={() => setModal('settings')}
          >
            <Settings2 size={18} />
          </button>
          <span className="avatar">TR</span>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> THE KEYBOARD IS YOUR ENGINE
            </div>
            <h1>
              Find your <em>fast.</em>
            </h1>
            <p>Four lanes. One finish line. Let your fingers do the driving.</p>
          </div>
          <div className="personal">
            <Trophy size={20} />
            <div>
              <small>YOUR PERSONAL BEST</small>
              <strong>
                {Math.round(stored.best || 0)} <span>WPM</span>
              </strong>
            </div>
            <ArrowUpRight size={18} />
          </div>
        </section>
        <div className="mode-bar">
          <div className="mode-tabs">
            {modes.map((x, i) => (
              <button
                disabled={active}
                className={mode === x ? 'active' : ''}
                key={x}
                onClick={() => changeMode(x)}
              >
                {i === 0 && <Flag size={15} />} {x}
              </button>
            ))}
          </div>
          <span className="local-tag">
            <i /> LOCAL CIRCUIT
          </span>
        </div>
        <div className="race-heading">
          <div>
            <h2>
              {mode === 'Quick race' ? 'Midnight sprint' : mode}{' '}
              <span>{['Practice', 'Time trial'].includes(mode) ? 'SOLO' : '4 RACERS'}</span>
            </h2>
            <p>
              {passage.category} <span>·</span> {race.text.length} characters <span>·</span>{' '}
              {mode === 'Time trial' ? `${duration} second session` : 'Precision meets pace'}
            </p>
          </div>
          <div className="race-controls">
            <label>
              DIFFICULTY{' '}
              <select
                aria-label="Difficulty"
                disabled={active}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                {Object.keys(difficulties).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            {mode === 'Time trial' && (
              <select
                aria-label="Trial duration"
                disabled={active}
                value={duration}
                onChange={(e) => setDuration(+e.target.value)}
              >
                {[15, 30, 60, 120].map((n) => (
                  <option value={n} key={n}>
                    {n}s
                  </option>
                ))}
              </select>
            )}
            {mode === 'Custom race' && (
              <select
                aria-label="Passage length"
                disabled={active}
                value={length}
                onChange={(e) => setLength(e.target.value)}
              >
                {['Short', 'Medium', 'Long'].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            )}
            <button
              className="icon-button"
              disabled={active}
              title="New passage"
              aria-label="New passage"
              onClick={() => setIndex(index + 1)}
            >
              <Shuffle size={17} />
            </button>
          </div>
        </div>
        <RaceTrack race={race} count={count} reduced={reduced} />
        <div className="hud">
          <div className="live-state">
            <i className={race.status === 'racing' ? 'on' : ''} />
            <span>
              {
                {
                  ready: 'ON THE GRID',
                  racing: 'RACE IN PROGRESS',
                  countdown: 'GET READY',
                  finished: 'CHEQUERED FLAG',
                  paused: 'RACE PAUSED',
                }[race.status]
              }
            </span>
          </div>
          <div>
            <Timer size={16} />
            <strong>
              {(mode === 'Time trial'
                ? Math.max(0, duration - race.elapsed)
                : race.elapsed
              ).toFixed(1)}
              <small>s</small>
            </strong>
          </div>
          <div>
            <Flag size={16} />
            <strong>
              {ordinal(rank)}
              <small> / {standings(race).length}</small>
            </strong>
          </div>
          <div className="hud-progress">
            <div>
              <i style={{ width: (race.cursor / race.text.length) * 100 + '%' }} />
            </div>
            <strong>
              {Math.floor((race.cursor / race.text.length) * 100)}
              <small>%</small>
            </strong>
          </div>
        </div>
        <section className="typing-panel" onClick={(event) => {
          if (!event.target.closest('button,select,a') && race.status === 'racing') {
            inputRef.current?.focus({ preventScroll: true });
          }
        }}>
          <div className="typing-top">
            <span>
              <Keyboard size={17} /> {results ? 'SESSION COMPLETE' : 'YOUR WORDS. YOUR HORSEPOWER.'}
            </span>
            <div>
              <span>
                <b>{Math.round(m.net)}</b> WPM
              </span>
              <span>
                <b>
                  {Math.round(m.accuracy)}
                  <small>%</small>
                </b>{' '}
                ACCURACY
              </span>
              <span>
                <b className={race.errors ? 'error-number' : ''}>{race.errors}</b> ERRORS
              </span>
            </div>
          </div>
          <div className="passage" aria-label="Typing passage">
            {race.text.split('').map((char, i) => (
              <span
                key={i}
                className={
                  i < race.cursor
                    ? 'correct'
                    : i === race.cursor
                      ? race.wrong
                        ? 'incorrect current'
                        : 'current'
                      : ''
                }
              >
                {char}
              </span>
            ))}
          </div>
          <div className="input-row direct-typing-input">
            <input
              ref={inputRef}
              aria-label="Type the highlighted passage. Tap the passage to focus."
              aria-describedby="typing-help"
              placeholder={
                race.status === 'ready'
                  ? 'Start your engine, then type here…'
                  : race.status === 'finished'
                    ? 'Race complete. Ready for another lap?'
                    : 'Type the highlighted character here…'
              }
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={race.status !== 'racing'}
              value={race.wrong}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onBeforeInput={(e) => {
                if (e.nativeEvent.inputType === 'insertFromPaste') e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.repeat) {
                  e.preventDefault();
                  return;
                }
                if (
                  e.key === 'Backspace' ||
                  (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
                ) {
                  e.preventDefault();
                  type(e.key);
                }
              }}
              onChange={(e) => {
                const value = e.target.value;
                if (!value && race.wrong) type('Backspace');
                else if (value.length === 1) type(value);
                else if (race.wrong && value.length === 2) type(value.slice(-1));
              }}
            />
            <span className={race.wrong ? 'input-hint wrong' : 'input-hint'}>
              {race.wrong ? (
                'Backspace to correct'
              ) : (
                <>
                  <span className="key">↵</span> Find your flow
                </>
              )}
            </span>
          </div>
          <div className="typing-bottom">
            <span id="typing-help" className={race.wrong ? 'typing-error' : ''}>
              <Target size={14} /> {race.wrong ? 'Press Backspace to correct the highlighted character.' : 'Type to race · Tap the text to focus'}
            </span>
            {['racing', 'paused'].includes(race.status) ? (
              <button className="primary" onClick={pause}>
                {race.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}{' '}
                {race.status === 'paused' ? 'Resume race' : 'Pause race'}
              </button>
            ) : (
              <button className="primary" disabled={race.status === 'countdown'} onClick={start}>
                {results ? <RotateCcw size={16} /> : <Flag size={16} />}{' '}
                {results ? 'Race again' : 'Start race'} <ArrowRight size={17} />
              </button>
            )}
          </div>
        </section>
        <div className="bottom-grid">
          <section className="drivers-panel">
            <div className="section-label">
              THE STARTING GRID <span>{difficulty.toUpperCase()} CIRCUIT</span>
            </div>
            <div className="drivers">
              {[
                { name: 'YOU', label: 'Your next personal best' },
                ...(!['Practice', 'Time trial'].includes(mode)
                  ? race.bots.map((b) => ({ ...b, label: `~${b.wpm} WPM · AI driver` }))
                  : []),
              ].map((b, i) => (
                <div className="driver-card" key={b.name}>
                  <span className="driver-swatch" style={{ background: colors[i] }} />
                  <div>
                    <strong>
                      {b.name} {i === 0 && <small>YOU</small>}
                    </strong>
                    <p>{b.label}</p>
                  </div>
                  {i === 0 && <Zap size={16} />}
                </div>
              ))}
            </div>
          </section>
          <section className="tip">
            <span className="section-label">
              PIT WALL NOTES <span>01 / 03</span>
            </span>
            <p>
              Slow is smooth.
              <br />
              <strong>Smooth is fast.</strong>
            </p>
            <small>Keep a steady rhythm. A clean lap beats a rushed one.</small>
          </section>
        </div>
        <footer>
          <span>
            <Zap size={12} /> BUILT FOR YOUR FLOW STATE.
          </span>
          <span>
            <kbd>ESC</kbd> Pause / resume <b>·</b> Progress saved on this device
          </span>
        </footer>
        {storageError && (
          <p role="status">
            Browser storage is unavailable. This session’s progress cannot be saved.
          </p>
        )}
      </main>
      {results && (
        <div className="modal-backdrop">
          <section
            className={`dialog results ${race.winner === 'YOU' ? 'victory' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Race results"
          >
            {race.winner === 'YOU' && !reduced && (
              <div className="confetti" aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      left: ((i * 37) % 100) + '%',
                      background: colors[i % 4],
                      animationDelay: (i % 7) * 0.14 + 's',
                    }}
                  />
                ))}
              </div>
            )}
            <div className="eyebrow">
              {race.winner === 'YOU' ? 'A LAP TO REMEMBER' : 'EVERY LAP MAKES YOU FASTER'}
            </div>
            <h2>
              {['Practice', 'Time trial'].includes(mode)
                ? 'Session complete.'
                : rank === 1
                  ? 'First across the line.'
                  : 'Keep chasing your fast.'}
            </h2>
            <p>
              {['Practice', 'Time trial'].includes(mode)
                ? 'Your solo session results'
                : `${race.winner} wins · You placed ${ordinal(rank)} · Other racers ranked by progress at the finish.`}
            </p>
            <div className="podium">
              {standings(race)
                .slice(0, 3)
                .map((b, i) => (
                  <div key={b.name}>
                    <RacingCar
                      color={
                        colors[
                          b.name === 'YOU' ? 0 : race.bots.findIndex((x) => x.name === b.name) + 1
                        ]
                      }
                      id={'pod' + i}
                    />
                    <strong>
                      {ordinal(i + 1)} · {b.name}
                    </strong>
                    <small>{Math.round((b.cursor / race.text.length) * 100)}% complete</small>
                  </div>
                ))}
            </div>
            <div className="result-metrics">
              <div>
                <strong>{Math.round(m.net)}</strong>
                <small>NET WPM</small>
              </div>
              <div>
                <strong>{Math.round(m.gross)}</strong>
                <small>GROSS WPM</small>
              </div>
              <div>
                <strong>{m.accuracy.toFixed(1)}%</strong>
                <small>ACCURACY</small>
              </div>
              <div>
                <strong>{race.elapsed.toFixed(1)}s</strong>
                <small>RACE TIME</small>
              </div>
            </div>
            <p className="result-details">
              {race.total} keystrokes · {race.correct} correct · {race.errors} errors ·{' '}
              {Math.round(m.cpm)} CPM
              <br />
              Best on this device: {Math.round(stored.best || 0)} WPM
            </p>
            <ResultsTable race={race} />
            <div className="result-actions">
              <button className="primary" onClick={start}>
                <RotateCcw size={16} /> Race again
              </button>
              <button
                onClick={() => {
                  setIndex(index + 1);
                  reset(mode, difficulty, index + 1);
                }}
              >
                Another passage
              </button>
              {mode === 'Challenge' && rank === 1 && difficulty !== 'Expert' && (
                <button
                  onClick={() =>
                    setDifficulty(
                      Object.keys(difficulties)[Object.keys(difficulties).indexOf(difficulty) + 1],
                    )
                  }
                >
                  Next difficulty →
                </button>
              )}
              <button
                onClick={() => {
                  reset();
                  setModal('settings');
                }}
              >
                Change difficulty
              </button>
              <button onClick={() => changeMode('Practice')}>Practice</button>
              <button
                onClick={() => {
                  reset();
                  setModal('home');
                }}
              >
                Home
              </button>
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            {modal === 'settings' ? (
              <>
                <div className="eyebrow">TUNE YOUR EXPERIENCE</div>
                <h2>Pit stop.</h2>
                <label className="setting">
                  Difficulty
                  <select
                    value={difficulty}
                    disabled={active}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    {Object.keys(difficulties).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className="setting">
                  Sound effects
                  <input
                    type="checkbox"
                    checked={soundOn}
                    onChange={(e) => setSoundOn(e.target.checked)}
                  />
                </label>
                <label className="setting">
                  Reduce motion
                  <input
                    type="checkbox"
                    checked={reduced}
                    onChange={(e) => setReduced(e.target.checked)}
                  />
                </label>
                <p>Races pause when you switch tabs. Paste and held-key repeats are disabled.</p>
              </>
            ) : modal === 'stats' ? (
              <>
                <div className="eyebrow">YOUR LOCAL LEADERBOARD</div>
                <h2>A little faster, every day.</h2>
                <p>Guest records on this device. No online rankings.</p>
                <div className="result-metrics">
                  <div>
                    <strong>{stored.completed || 0}</strong>
                    <small>SESSIONS</small>
                  </div>
                  <div>
                    <strong>{stored.wins || 0}</strong>
                    <small>WINS</small>
                  </div>
                  <div>
                    <strong>{stored.losses || 0}</strong>
                    <small>LOSSES</small>
                  </div>
                  <div>
                    <strong>{Math.round(stored.accuracy || 0)}%</strong>
                    <small>BEST ACCURACY</small>
                  </div>
                </div>
                <div className="history">
                  {!(stored.history || []).length ? (
                    <p>Your first lap is waiting. Start a race to set your benchmark.</p>
                  ) : (
                    [...(stored.history || [])]
                      .sort((a, b) => b.net - a.net)
                      .map((r) => (
                        <div key={r.id}>
                          <span>
                            {r.mode}
                            <small>
                              {r.date} · {r.difficulty}
                            </small>
                          </span>
                          <strong>{r.net} WPM</strong>
                          <span>{r.accuracy}%</span>
                        </div>
                      ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="eyebrow">WELCOME TO TYPERUSH</div>
                <h2>
                  Your keyboard.
                  <br />
                  An open road.
                </h2>
                <p>
                  Type the passage exactly as shown. Correct characters move your car; use Backspace
                  to fix mistakes. The first driver to the line ends the race.
                </p>
                <button className="primary" onClick={() => changeMode('Quick race')}>
                  Head to the grid <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
