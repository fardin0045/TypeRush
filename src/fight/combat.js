import { seeded } from '../engine.js';
import { LEVEL_INDEX, moveClip } from './moves.js';
export const LEVELS = {
  Easy: { wpm: 24, accuracy: 0.87, defense: 0.12 },
  Normal: { wpm: 42, accuracy: 0.93, defense: 0.25 },
  Hard: { wpm: 64, accuracy: 0.96, defense: 0.36 },
  Expert: { wpm: 85, accuracy: 0.985, defense: 0.48 },
};
const fighter = (name) => ({
  name,
  hp: 100,
  combo: 0,
  bestCombo: 0,
  attacks: 0,
  landed: 0,
  damage: 0,
  wins: 0,
  losses: 0,
  total: 0,
  correct: 0,
  errors: 0,
  stance: 'attack',
  cursor: 0,
  wrong: '',
  roundErrors: 0,
  punches: 0,
});
export function createMatch(difficulty = 'Normal', mode = 'Quick Fight', seed = 42) {
  return {
    difficulty: LEVELS[difficulty] ? difficulty : 'Normal',
    mode,
    seed,
    random: seeded(seed),
    status: 'ready',
    clock: 0,
    elapsed: 0,
    typingTime: 0,
    round: 0,
    word: '',
    move: 'Punch',
    baseDamage: 11,
    deadline: 0,
    phaseEnd: 0,
    aiNext: 0,
    aiRecover: false,
    event: null,
    eventId: 0,
    winner: null,
    player: fighter('YOU'),
    enemy: fighter('ECHO'),
    lastMove: -1,
    strikes: [],
    strikeId: 0,
  };
}
export function startMatch(s) {
  if (s.status !== 'ready') return false;
  s.status = 'countdown';
  s.phaseEnd = s.clock + 3;
  return true;
}
function challenge(s) {
  s.status = 'fighting';
  s.round++;
  const words = WORDS[LEVEL_INDEX[s.difficulty]];
  let index = Math.floor(s.random() * words.length);
  if (index === s.lastMove) index = (index + 1) % words.length;
  s.lastMove = index;
  s.word = words[index];
  s.move = ['Roundhouse', 'Flying kick', 'Spinning kick'][(s.round - 1) % 3];
  s.baseDamage = moveClip(s.move).damage;
  s.strikes = [];
  for (const f of [s.player, s.enemy]) {
    f.cursor = 0;
    f.wrong = '';
    f.roundErrors = 0;
    f.stance = 'attack';
  }
  const config = LEVELS[s.difficulty];
  const defense = s.random();
  s.enemy.stance =
    s.mode !== 'Versus' && defense < config.defense
      ? s.random() < 0.5
        ? 'block'
        : 'dodge'
      : 'attack';
  s.roundStart = s.clock;
  s.deadline = s.clock + Math.max(4, (s.word.length / ((config.wpm * 5) / 60)) * 2.4 + 1);
  s.aiNext = s.clock + 0.6 + 60 / (config.wpm * 5);
  s.aiRecover = false;
  s.event = null;
}
export function setStance(s, stance) {
  if (s.status !== 'fighting' || !['attack', 'block', 'dodge'].includes(stance)) return;
  s.player.stance = stance;
}
export function attackDamage(base, combo, accuracy = 1, stance = 'attack') {
  return Math.round(
    base *
      (1 + Math.min(combo - 1, 5) * 0.23) *
      (accuracy === 1 ? 1.12 : 1) *
      (stance === 'attack' ? 1 : stance === 'block' ? 0.75 : 0.65),
  );
}
export function comboMove(move, combo) {
  // Chains amplify power without replacing the move promised by the word.
  return move;
}
function resolve(s, side) {
  if (s.status !== 'fighting') return;
  const attacker = s[side],
    defender = s[side === 'player' ? 'enemy' : 'player'];
  attacker.wins++;
  attacker.combo++;
  attacker.bestCombo = Math.max(attacker.bestCombo, attacker.combo);
  attacker.attacks++;
  defender.losses++;
  defender.combo = 0;
  const raw = attackDamage(
    s.baseDamage,
    attacker.combo,
    attacker.roundErrors === 0 ? 1 : 0.9,
    attacker.stance,
  );
  const evaded = defender.stance === 'dodge' && s.random() < 0.6;
  const blocked = defender.stance === 'block';
  const damage = evaded ? 0 : Math.round(raw * (blocked ? 0.4 : 1));
  if (damage > 0) {
    attacker.landed++;
    attacker.damage += damage;
  }
  const move = comboMove(s.move, attacker.combo);
  const clip = moveClip(move);
  s.event = {
    id: ++s.eventId,
    side,
    move,
    damage,
    defense: evaded ? 'dodge' : blocked ? 'block' : 'hit',
    combo: attacker.combo,
    at: Math.max(s.clock, ...s.strikes.map((p) => p.at + p.duration)),
    knockdown: !evaded && !blocked && (clip.knockdown || damage >= 22),
    contacts: clip.contacts,
    duration: clip.duration,
    impactAt: clip.contacts.at(-1),
    impactApplied: false,
  };
  s.status = 'attack';
  s.phaseEnd = s.event.at + clip.duration;
}
const WORDS = [
  [
    'jab',
    'dash',
    'swift',
    'spark',
    'brave',
    'flash',
    'storm',
    'pulse',
    'blaze',
    'sharp',
    'quick',
    'strike',
  ],
  [
    'momentum',
    'thunder',
    'courage',
    'balance',
    'fighter',
    'counter',
    'rhythm',
    'victory',
    'agility',
    'defender',
    'powerful',
    'lightning',
  ],
  [
    'determined',
    'confidence',
    'precision',
    'relentless',
    'resilience',
    'fearless',
    'unstoppable',
    'discipline',
    'endurance',
    'champion',
    'explosive',
    'technique',
  ],
  [
    'extraordinary',
    'determination',
    'unpredictable',
    'perseverance',
    'concentration',
    'uncompromising',
    'invulnerability',
    'counterattack',
    'acceleration',
    'coordination',
    'indestructible',
    'transformation',
  ],
];
function punch(s, side) {
  const f = s[side];
  const previous = s.strikes.filter((p) => p.side === side).at(-1);
  const at = Math.max(s.clock, previous ? previous.at + previous.duration : s.clock);
  s.strikes.push({
    id: ++s.strikeId,
    side,
    hand: f.punches++ % 2 === 0 ? 'left' : 'right',
    at,
    duration: 0.14,
    contact: 0.055,
  });
}
export function typeCharacter(s, key, side = 'player') {
  if (!['player', 'enemy'].includes(side)) return;
  if (s.status !== 'fighting') return;
  const f = s[side];
  if (key === 'Backspace') {
    if (f.wrong) f.wrong = '';
    else f.cursor = Math.max(0, f.cursor - 1);
    return;
  }
  if (key.length !== 1) return;
  f.total++;
  if (!f.wrong && key === s.word[f.cursor]) {
    f.correct++;
    f.cursor++;
    punch(s, side);
    if (f.cursor === s.word.length) resolve(s, side);
  } else {
    f.errors++;
    f.roundErrors++;
    f.wrong = key;
  }
}
function aiCharacter(s) {
  const f = s.enemy,
    config = LEVELS[s.difficulty];
  if (s.aiRecover) {
    s.aiRecover = false;
    f.wrong = '';
  } else {
    f.total++;
    if (s.random() > config.accuracy) {
      f.errors++;
      f.roundErrors++;
      f.wrong = '?';
      s.aiRecover = true;
    } else {
      f.correct++;
      f.cursor++;
      punch(s, 'enemy');
    }
  }
  if (f.cursor === s.word.length) {
    resolve(s, 'enemy');
    return;
  }
  s.aiNext =
    s.clock + (60 / (config.wpm * 5)) * (0.75 + s.random() * 0.5) * (s.aiRecover ? 1.8 : 1);
}
export function advanceMatch(s, delta) {
  if (['ready', 'paused', 'finished'].includes(s.status) || delta <= 0) return;
  const end = s.clock + delta;
  while (s.clock < end - 1e-9 && !['ready', 'paused', 'finished'].includes(s.status)) {
    let next = end;
    if (s.status === 'fighting' && s.mode !== 'Practice')
      next = Math.min(next, s.mode === 'Versus' ? Infinity : s.aiNext, s.deadline);
    else if (s.status !== 'fighting') next = Math.min(next, s.phaseEnd);
    if (s.status === 'attack' && !s.event.impactApplied)
      next = Math.min(next, s.event.at + s.event.impactAt);
    const dt = Math.max(0, next - s.clock);
    if (s.status !== 'countdown') s.elapsed += dt;
    if (s.status === 'fighting') s.typingTime += dt;
    s.clock = next;
    if (
      s.status === 'attack' &&
      !s.event.impactApplied &&
      s.clock >= s.event.at + s.event.impactAt - 1e-9
    ) {
      s.event.impactApplied = true;
      const defender = s[s.event.side === 'player' ? 'enemy' : 'player'];
      if (s.mode !== 'Practice') defender.hp = Math.max(0, defender.hp - s.event.damage);
      if (defender.hp === 0) {
        s.winner = s.event.side;
        s.event.defeated = true;
        if (['Roundhouse', 'Flying kick', 'Spinning kick'].includes(s.event.move)) {
          s.event.launch = true;
          s.event.landingAt = s.event.impactAt + 0.85;
          s.event.duration = s.event.landingAt + 0.45;
          s.phaseEnd = s.event.at + s.event.duration;
        }
      }
    }
    if (s.status === 'countdown' && s.clock >= s.phaseEnd - 1e-9) challenge(s);
    else if (s.status === 'fighting' && s.mode !== 'Practice') {
      if (s.mode !== 'Versus' && s.clock >= s.aiNext - 1e-9) aiCharacter(s);
      if (s.status === 'fighting' && s.clock >= s.deadline - 1e-9) {
        s.player.combo = 0;
        s.enemy.combo = 0;
        s.player.losses++;
        s.enemy.losses++;
        s.event = {
          id: ++s.eventId,
          side: null,
          move: 'Time out',
          damage: 0,
          combo: 0,
          at: s.clock,
        };
        s.status = 'recovery';
        s.phaseEnd = s.clock + 0.55;
      }
    } else if (s.status === 'attack' && s.clock >= s.phaseEnd - 1e-9) {
      s.status = s.winner ? 'finished' : 'recovery';
      s.phaseEnd = s.clock + 0.35;
    } else if (s.status === 'recovery' && s.clock >= s.phaseEnd - 1e-9) challenge(s);
  }
}
export function pauseMatch(s) {
  if (s.status === 'paused') {
    s.status = s.beforePause;
    return;
  }
  if (!['ready', 'finished'].includes(s.status)) {
    s.beforePause = s.status;
    s.status = 'paused';
  }
}
export function matchStats(s) {
  const f = s.player;
  return {
    accuracy: f.total ? (f.correct / f.total) * 100 : 100,
    wpm: s.typingTime ? f.correct / 5 / (s.typingTime / 60) : 0,
    combo: f.bestCombo,
    correctChallenges: f.wins,
    failedChallenges: f.losses,
    errors: f.errors,
    landed: f.landed,
    attacks: f.attacks,
    damage: f.damage,
    duration: s.elapsed,
  };
}
