import { createMatch, typeCharacter, pauseMatch } from './combat.js';
export function versusMatch(level = 'Normal') {
  const s = createMatch(level, 'Versus', crypto.getRandomValues(new Uint32Array(1))[0]);
  s.player.name = 'HOST';
  s.enemy.name = 'FRIEND';
  return s;
}
export function snapshot(s, epoch, ready) {
  return { type: 'state', epoch, ready, state: JSON.parse(JSON.stringify(s)) };
}
export function validSnapshot(m) {
  const s = m?.state;
  return (
    m?.type === 'state' &&
    Number.isSafeInteger(m.epoch) &&
    s?.mode === 'Versus' &&
    ['ready', 'countdown', 'fighting', 'attack', 'recovery', 'paused', 'finished'].includes(
      s.status,
    ) &&
    Number.isFinite(s.clock) &&
    Number.isFinite(s.phaseEnd) &&
    Number.isFinite(s.deadline) &&
    Number.isInteger(s.round) &&
    (!s.event ||
      (typeof s.event.move === 'string' &&
        ['player', 'enemy', null].includes(s.event.side) &&
        Number.isFinite(s.event.at) &&
        (!s.event.side ||
          (Array.isArray(s.event.contacts) &&
            s.event.contacts.length <= 4 &&
            s.event.contacts.every(Number.isFinite))))) &&
    typeof s.word === 'string' &&
    s.word.length < 40 &&
    Array.isArray(s.strikes) &&
    s.strikes.length < 1000 &&
    s.strikes.every(
      (p) =>
        p &&
        ['player', 'enemy'].includes(p.side) &&
        ['left', 'right'].includes(p.hand) &&
        Number.isFinite(p.at) &&
        Number.isFinite(p.duration) &&
        Number.isFinite(p.contact),
    ) &&
    ['player', 'enemy'].every(
      (side) =>
        s[side] &&
        Number.isFinite(s[side].hp) &&
        s[side].hp >= 0 &&
        s[side].hp <= 100 &&
        Number.isInteger(s[side].cursor) &&
        s[side].cursor >= 0 &&
        s[side].cursor <= s.word.length,
    )
  );
}
export function applyAction(s, m, side, epoch) {
  if (!m || m.epoch !== epoch) return;
  if (
    m.type === 'key' &&
    m.round === s.round &&
    typeof m.key === 'string' &&
    (m.key === 'Backspace' || /^[a-z]$/.test(m.key))
  )
    typeCharacter(s, m.key, side);
  if (m.type === 'pause' && typeof m.paused === 'boolean' && m.paused !== (s.status === 'paused'))
    pauseMatch(s);
  if (
    m.type === 'stance' &&
    s.status === 'fighting' &&
    ['attack', 'block', 'dodge'].includes(m.stance)
  )
    s[side].stance = m.stance;
}
