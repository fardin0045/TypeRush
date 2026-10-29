import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Swords,
  Shield,
  Zap,
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Target,
} from 'lucide-react';
import {
  createMatch,
  startMatch,
  advanceMatch,
  typeCharacter,
  pauseMatch,
  setStance,
  matchStats,
  LEVELS,
} from './combat.js';
import FightingArena from './FightingArena.jsx';
import { fightSound, playCombatTimeline } from './fightAudio.js';
import { load, save } from '../storage.js';
import { keyboardClick } from '../audio.js';
export default function TypeFightPage() {
  const [difficulty, setDifficulty] = useState(() => load().difficulty || 'Normal'),
    [mode, setMode] = useState('Quick Fight');
  const [soundOn, setSoundOn] = useState(() => !!load().sound),
    [reduced, setReduced] = useState(
      () => load().reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  const [, render] = useState(0),
    [notice, setNotice] = useState('');
  const state = useRef(createMatch(difficulty, mode)),
    input = useRef(null),
    last = useRef(0),
    recorded = useRef(false),
    settings = useRef({ soundOn });
  settings.current = { soundOn };
  const s = state.current,
    stats = matchStats(s),
    active = !['ready', 'finished'].includes(s.status);
  function changed() {
    const match = state.current;
    playCombatTimeline(match, settings.current.soundOn);
    if (match.status === 'finished' && !recorded.current) {
      recorded.current = true;
      fightSound(settings.current.soundOn, match.winner === 'player' ? 'win' : 'lose');
      const previous = load();
      if (
        !save({
          ...previous,
          fight: {
            matches: (previous.fight?.matches || 0) + 1,
            wins: (previous.fight?.wins || 0) + (match.winner === 'player' ? 1 : 0),
            bestCombo: Math.max(previous.fight?.bestCombo || 0, match.player.bestCombo),
            last: { ...matchStats(match), difficulty: match.difficulty, winner: match.winner },
          },
        })
      )
        setNotice('Browser storage is unavailable; this result could not be saved.');
    }
    render((v) => v + 1);
  }
  function sync() {
    const now = performance.now();
    advanceMatch(state.current, Math.max(0, (now - last.current) / 1000));
    last.current = now;
  }
  function reset(level = difficulty, newMode = mode) {
    state.current = createMatch(level, newMode, 42);
    recorded.current = false;
    last.current = performance.now();
    render((v) => v + 1);
  }
  function begin() {
    if (!['ready', 'finished'].includes(state.current.status)) return;
    if (state.current.status === 'finished') reset();
    startMatch(state.current);
    last.current = performance.now();
    fightSound(soundOn, 'start');
    changed();
  }
  function togglePause() {
    sync();
    pauseMatch(state.current);
    changed();
  }
  function type(key) {
    sync();
    const before = state.current.status;
    typeCharacter(state.current, key);
    if (before === 'fighting') keyboardClick(soundOn, key);
    changed();
  }
  useEffect(() => {
    const old = load();
    save({ ...old, sound: soundOn, reduced, difficulty });
  }, [soundOn, reduced, difficulty]);
  useEffect(() => {
    let frame,
      paint = 0;
    const loop = (now) => {
      const before = state.current.status;
      if (!['ready', 'paused', 'finished'].includes(before)) {
        advanceMatch(state.current, (now - last.current) / 1000);
        playCombatTimeline(state.current, settings.current.soundOn);
        if (state.current.status !== before || now - paint > 33) {
          changed();
          paint = now;
        }
      }
      last.current = now;
      frame = requestAnimationFrame(loop);
    };
    last.current = performance.now();
    frame = requestAnimationFrame(loop);
    const visibility = () => {
      if (document.hidden && !['ready', 'paused', 'finished'].includes(state.current.status)) {
        sync();
        pauseMatch(state.current);
        changed();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      const root = document.querySelector('.fight-page');
      if (!root) return;
      const height = viewport?.height || window.innerHeight;
      root.style.setProperty('--visible-height', `${height}px`);
      root.classList.toggle(
        'keyboard-open',
        window.innerWidth < 700 && window.innerHeight - height > 120,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    return () => viewport?.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (s.status === 'fighting') input.current?.focus({ preventScroll: true });
  }, [s.status, s.round]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (e.target.closest?.('input,button,select,a')) return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === 'Backspace')) {
        e.preventDefault();
        if (!e.repeat) type(e.key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [soundOn]);
  useEffect(() => {
    if (s.status !== 'finished') return;
    const dialog = document.querySelector('.fight-result');
    dialog?.querySelector('button')?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('button,a')],
        first = items[0],
        end = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [s.status]);
  const remaining = s.mode === 'Practice' ? '∞' : Math.max(0, s.deadline - s.clock).toFixed(1);
  return (
    <div className={`fight-page ${reduced ? 'fight-reduced' : ''}`}>
      <div className="fight-nav">
        <a className="fight-brand" href="#/games">
          <Swords size={24} /> type<span>fight</span>
        </a>
        <div className="fight-game-links">
          <a href="#/race">TypeRush</a>
          <a className="active" href="#/fight">
            TypeFight
          </a>
          <a href="#/fight/friend">Play a friend</a>
          <a href="#/games">Games</a>
        </div>
        <div className="fight-tools">
          <button
            aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
            onClick={() => {
              setSoundOn(!soundOn);
              fightSound(!soundOn, 'start');
            }}
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            disabled={!active}
            aria-label={s.status === 'paused' ? 'Resume fight' : 'Pause fight'}
            onClick={togglePause}
          >
            {s.status === 'paused' ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
      </div>
      <div className="fight-content">
        <div className="fight-title">
          <div>
            <span className="fight-kicker">WORDS HIT HARDER.</span>
            <h1>
              Make every <em>key count.</em>
            </h1>
          </div>
          <div className="fight-options">
            <select
              aria-label="Fight mode"
              value={mode}
              disabled={active}
              onChange={(e) => {
                setMode(e.target.value);
                reset(difficulty, e.target.value);
              }}
            >
              <option>Quick Fight</option>
              <option>Practice</option>
            </select>
            <select
              aria-label="Fight difficulty"
              value={difficulty}
              disabled={active}
              onChange={(e) => {
                setDifficulty(e.target.value);
                reset(e.target.value);
              }}
            >
              {Object.keys(LEVELS).map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="fight-stage">
          <div className="combat-hud">
            <HealthBar fighter={s.player} player />
            <div className="round-badge">
              <span>
                {s.status === 'ready'
                  ? 'READY'
                  : s.status === 'countdown'
                    ? 'GET READY'
                    : `ROUND ${String(s.round).padStart(2, '0')}`}
              </span>
              <strong>
                {Math.floor(s.elapsed / 60)
                  .toString()
                  .padStart(2, '0')}
                :
                {Math.floor(s.elapsed % 60)
                  .toString()
                  .padStart(2, '0')}
              </strong>
            </div>
            <HealthBar fighter={s.enemy} />
          </div>
          <FightingArena match={s} reduced={reduced} />
          <div className="fight-live-message" aria-live="polite">
            {s.status === 'countdown' ? (
              <>
                <strong>{Math.max(1, Math.ceil(s.phaseEnd - s.clock))}</strong>
                <span>HANDS READY. MIND CLEAR.</span>
              </>
            ) : s.status === 'paused' ? (
              <>
                <strong>PAUSED</strong>
                <button onClick={togglePause}>
                  Resume fight <Play size={15} />
                </button>
              </>
            ) : null}
          </div>
          <div className="fight-side-note">
            <span>YOUR CHAIN</span>
            <strong>
              {s.player.combo}
              <small>×</small>
            </strong>
            <p>
              {s.player.combo < 2
                ? 'Build your rhythm'
                : s.player.combo < 4
                  ? 'Keep the chain going'
                  : s.player.combo < 6
                    ? 'You are on a roll'
                    : 'UNSTOPPABLE'}
            </p>
          </div>
          <div
            className="challenge-card"
            onClick={(e) => {
              if (!e.target.closest('button') && s.status === 'fighting')
                input.current?.focus({ preventScroll: true });
            }}
          >
            <div className="challenge-meta">
              <span>
                <Target size={14} />
                {s.status === 'ready' ? 'THE FIRST WORD IS YOURS' : 'FIND YOUR RHYTHM'}
              </span>
              <span>{s.status === 'fighting' ? `${remaining}s` : 'TYPE TO STRIKE'}</span>
            </div>
            <div className="fight-word" aria-label="Fight typing challenge">
              {s.word
                ? s.word.split('').map((c, i) => (
                    <span
                      key={i}
                      className={
                        i < s.player.cursor
                          ? 'done'
                          : i === s.player.cursor
                            ? s.player.wrong
                              ? 'bad current'
                              : 'current'
                            : ''
                      }
                    >
                      {c}
                    </span>
                  ))
                : 'ready to fight?'}
            </div>
            <input
              className="fight-input"
              ref={input}
              aria-label="Type the fight challenge"
              value={s.player.wrong}
              disabled={s.status !== 'fighting'}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') return;
                if (e.repeat) {
                  e.preventDefault();
                  return;
                }
                if (
                  !e.ctrlKey &&
                  !e.metaKey &&
                  !e.altKey &&
                  (e.key.length === 1 || e.key === 'Backspace')
                ) {
                  e.preventDefault();
                  type(e.key);
                }
              }}
              onChange={(e) => {
                const value = e.target.value;
                if (!value && s.player.wrong) type('Backspace');
                else if (value.length === 1) type(value);
                else if (s.player.wrong && value.length === 2) type(value.slice(-1));
              }}
            />
            <div className="challenge-foot">
              <span className={s.player.wrong ? 'enemy-text' : ''}>
                {s.player.wrong
                  ? 'Backspace to correct your mistake.'
                  : s.status === 'fighting'
                    ? 'Type the word. First to finish strikes.'
                    : 'Clean words. Stronger combos.'}
              </span>
              {s.status === 'ready' ? (
                <button className="fight-primary" onClick={begin}>
                  Start fight <ArrowRight size={16} />
                </button>
              ) : (
                <span>
                  {Math.round(stats.accuracy)}% ACC · {Math.round(stats.wpm)} WPM
                </span>
              )}
            </div>
            {s.status === 'fighting' && (
              <div className="enemy-progress">
                <span>ECHO TYPING</span>
                <div>
                  <i style={{ width: (s.enemy.cursor / Math.max(1, s.word.length)) * 100 + '%' }} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="fight-bottom">
          <div className="stance-select" aria-label="Defensive stance">
            {[
              ['attack', Zap, 'Attack', 'Full damage'],
              ['block', Shield, 'Block', '60% less incoming · 25% less outgoing'],
              ['dodge', ArrowLeft, 'Dodge', '60% evade chance · 35% less damage'],
            ].map(([value, Icon, label, title]) => (
              <button
                key={value}
                title={title}
                disabled={s.status !== 'fighting'}
                aria-pressed={s.player.stance === value}
                className={s.player.stance === value ? 'selected' : ''}
                onClick={() => {
                  setStance(s, value);
                  changed();
                  input.current?.focus({ preventScroll: true });
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <p className="stance-description">
            {s.player.stance === 'attack'
              ? 'Attack stance: full damage.'
              : s.player.stance === 'block'
                ? 'Block: absorb 60% damage; deal 25% less.'
                : 'Dodge: 60% evade chance; deal 35% less.'}
          </p>
          <label className="motion-setting">
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => setReduced(e.target.checked)}
            />
            Reduce motion
          </label>
          {mode === 'Practice' && active && (
            <button
              className="end-practice"
              onClick={() => {
                s.status = 'ready';
                reset();
              }}
            >
              End practice
            </button>
          )}
        </div>
        <div className="fight-help">
          <span>
            <kbd>ESC</kbd> Pause / resume
          </span>
          <span>
            {mode === 'Practice'
              ? 'Practice: no timer, no AI attacks, unlimited health.'
              : 'Win consecutive words to build real damage multipliers.'}
          </span>
          <a href="#/games">Choose another game ↗</a>
        </div>
        {notice && <p role="status">{notice}</p>}
      </div>
      {s.status === 'finished' && (
        <div className="fight-result-backdrop">
          <section
            className="fight-result"
            role="dialog"
            aria-modal="true"
            aria-label="Match results"
          >
            <Trophy size={32} />
            <span className="fight-kicker">
              {s.winner === 'player' ? 'YOUR WORDS. YOUR VICTORY.' : 'THE NEXT ROUND IS YOURS.'}
            </span>
            <h2>{s.winner === 'player' ? 'You win.' : 'Echo wins.'}</h2>
            <p>
              {s.winner === 'player'
                ? 'A clean finish on the rooftop.'
                : 'Find your rhythm, then fight again.'}
            </p>
            <div className="fight-result-grid">
              {[
                [`${stats.combo}×`, 'BEST COMBO'],
                [`${stats.accuracy.toFixed(1)}%`, 'ACCURACY'],
                [Math.round(stats.wpm), 'TYPING WPM'],
                [`${stats.duration.toFixed(1)}s`, 'MATCH TIME'],
                [stats.correctChallenges, 'WORDS WON'],
                [stats.failedChallenges, 'WORDS LOST'],
                [stats.landed, 'ATTACKS LANDED'],
                [stats.errors, 'TYPING ERRORS'],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="fight-result-actions">
              <button className="fight-primary" onClick={begin}>
                <RotateCcw size={16} />
                Fight again
              </button>
              <button onClick={() => reset()}>Change difficulty</button>
              <a href="#/games">Game selection</a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function HealthBar({ fighter, player }) {
  return (
    <div className={`health-card ${player ? 'player' : 'enemy'}`}>
      <div>
        <strong>{fighter.name}</strong>
        <span>{player ? 'THE CHALLENGER' : 'NEON SENTINEL'}</span>
        <b>
          {fighter.hp}
          <small> / 100</small>
        </b>
      </div>
      <div className="health-track">
        <i style={{ width: fighter.hp + '%' }} />
      </div>
      <p>{fighter.combo ? `${fighter.combo}× CHAIN` : 'READY TO STRIKE'}</p>
    </div>
  );
}
