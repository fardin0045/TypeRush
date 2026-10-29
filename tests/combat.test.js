import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch,
  startMatch,
  advanceMatch,
  typeCharacter,
  attackDamage,
  setStance,
  pauseMatch,
  LEVELS,
  matchStats,
} from '../src/fight/combat.js';
function fighting(level = 'Easy', mode = 'Quick Fight') {
  const s = createMatch(level, mode, 42);
  startMatch(s);
  advanceMatch(s, 3);
  return s;
}
function complete(s) {
  for (const c of s.word) typeCharacter(s, c);
}
function next(s) {
  while (!['fighting', 'finished'].includes(s.status)) advanceMatch(s, 0.05);
}
test('countdown cannot be duplicated and challenge is nonempty', () => {
  const s = createMatch();
  assert.ok(startMatch(s));
  assert.equal(startMatch(s), false);
  advanceMatch(s, 3);
  assert.equal(s.status, 'fighting');
  assert.ok(s.word.length > 0);
});
test('wrong characters block completion until backspace, attacks resolve once', () => {
  const s = fighting();
  typeCharacter(s, '~');
  complete(s);
  assert.equal(s.player.cursor, 0);
  assert.equal(s.enemy.hp, 100);
  typeCharacter(s, 'Backspace');
  complete(s);
  assert.equal(s.status, 'attack');
  assert.equal(s.player.attacks, 1);
  complete(s);
  assert.equal(s.player.attacks, 1);
  assert.equal(s.enemy.hp, 100);
  advanceMatch(s, s.event.at - s.clock + s.event.impactAt);
  assert.ok(s.enemy.hp < 100);
});
test('combo affects actual damage and perfect accuracy bonus', () => {
  assert.ok(attackDamage(11, 4) > attackDamage(11, 1));
  assert.ok(attackDamage(11, 1, 1) > attackDamage(11, 1, 0.9));
});
test('a full player win ends match and results use recorded data', () => {
  const s = fighting();
  let rounds = 0;
  while (s.status !== 'finished' && rounds++ < 30) {
    if (s.status === 'fighting') complete(s);
    next(s);
  }
  assert.equal(s.winner, 'player');
  assert.equal(s.enemy.hp, 0);
  assert.ok(s.player.bestCombo >= 4);
  assert.equal(matchStats(s).accuracy, 100);
  assert.equal(matchStats(s).correctChallenges, s.player.attacks);
  const hp = s.player.hp;
  advanceMatch(s, 100);
  assert.equal(s.player.hp, hp);
});
test('AI completes real challenges, deals damage and can win without player input', () => {
  const s = fighting('Expert');
  advanceMatch(s, 150);
  assert.equal(s.status, 'finished');
  assert.equal(s.winner, 'enemy');
  assert.ok(s.enemy.total >= s.enemy.correct);
  assert.ok(s.enemy.wins > 0);
  assert.equal(s.player.hp, 0);
});
test('blocking reduces damage and dodge can evade; offensive cost applies', () => {
  const a = fighting(),
    b = fighting();
  a.enemy.stance = 'attack';
  b.enemy.stance = 'block';
  complete(a);
  complete(b);
  assert.ok(b.event.damage < a.event.damage);
  const c = fighting();
  c.enemy.stance = 'dodge';
  c.random = () => 0;
  complete(c);
  assert.equal(c.event.damage, 0);
  assert.equal(c.event.defense, 'dodge');
  assert.ok(attackDamage(15, 2, 1, 'block') < attackDamage(15, 2, 1, 'attack'));
});
test('pause freezes clocks and input and resumes exact state', () => {
  const s = fighting();
  pauseMatch(s);
  advanceMatch(s, 100);
  typeCharacter(s, s.word[0]);
  assert.equal(s.clock, 3);
  assert.equal(s.player.cursor, 0);
  pauseMatch(s);
  assert.equal(s.status, 'fighting');
});
test('practice has no deadline or AI attacks and preserves health', () => {
  const s = fighting('Easy', 'Practice');
  advanceMatch(s, 600);
  assert.equal(s.enemy.cursor, 0);
  assert.equal(s.status, 'fighting');
  complete(s);
  assert.equal(s.enemy.hp, 100);
});
test('difficulty affects AI speed and word complexity', () => {
  assert.equal(Object.keys(LEVELS).length, 4);
  const a = fighting('Easy'),
    b = fighting('Expert');
  assert.ok(a.word.length < b.word.length);
  assert.ok(LEVELS.Easy.wpm < LEVELS.Expert.wpm);
});
test('AI victory resets player chain; late player completion cannot override AI', () => {
  const s = fighting('Expert');
  s.player.combo = 3;
  while (s.status === 'fighting') advanceMatch(s, 0.01);
  assert.equal(s.event.side, 'enemy');
  assert.equal(s.player.combo, 0);
  complete(s);
  assert.equal(s.event.side, 'enemy');
});
test('simulation is seeded and independent of frame interval', () => {
  const a = fighting('Normal'),
    b = fighting('Normal');
  advanceMatch(a, 20);
  for (let i = 0; i < 2000; i++) advanceMatch(b, 0.01);
  assert.equal(a.player.hp, b.player.hp);
  assert.equal(a.enemy.attacks, b.enemy.attacks);
  assert.equal(a.round, b.round);
});
test('fresh match resets health, combo, inputs and metrics', () => {
  const s = fighting();
  complete(s);
  const fresh = createMatch();
  assert.equal(fresh.player.hp, 100);
  assert.equal(fresh.player.combo, 0);
  assert.equal(fresh.player.total, 0);
  assert.equal(fresh.event, null);
});
import { MOVE_SET, combatCues } from '../src/fight/moves.js';
import { combatPose } from '../src/fight/choreography.js';
import { playCombatTimeline } from '../src/fight/fightAudio.js';
test('all difficulties use one word and completion always queues a kick', () => {
  for (const level of Object.keys(LEVELS)) {
    const s = fighting(level, 'Practice');
    for (let i = 0; i < 15; i++) {
      assert.match(s.word, /^[a-z]+$/);
      complete(s);
      assert.ok(['Roundhouse', 'Flying kick', 'Spinning kick'].includes(s.event.move));
      assert.equal(s.strikes.length, s.word.length);
      assert.ok(s.event.at >= s.strikes.at(-1).at + s.strikes.at(-1).duration);
      next(s);
    }
  }
});
test('every choreography has finite continuous poses for both fighters', () => {
  for (const clip of MOVE_SET) {
    const event = { move: clip.name, defense: null, knockdown: !!clip.knockdown };
    for (const role of ['attacker', 'defender']) {
      let previous;
      for (let t = 0; t <= clip.duration; t += 0.002) {
        const p = combatPose(event, role, t, 0);
        const values = [p.x, p.y, p.rotation, ...p.joints.flat()];
        assert.ok(values.every(Number.isFinite), clip.name);
        if (previous)
          assert.ok(
            Math.max(...values.map((v, i) => Math.abs(v - previous[i]))) < 30,
            `${clip.name} ${role} transition at ${t}`,
          );
        previous = values;
      }
    }
  }
});
test('impact is delayed, pause freezes it and damage applies only once', () => {
  const s = fighting();
  complete(s);
  advanceMatch(s, s.event.at - s.clock + s.event.impactAt - 0.01);
  assert.equal(s.enemy.hp, 100);
  pauseMatch(s);
  advanceMatch(s, 10);
  assert.equal(s.enemy.hp, 100);
  pauseMatch(s);
  advanceMatch(s, 0.01);
  const hp = s.enemy.hp;
  assert.ok(hp < 100);
  advanceMatch(s, 0.01);
  assert.equal(s.enemy.hp, hp);
});
test('audio uses contact times, consumes muted cues and never repeats on resume', () => {
  for (const clip of MOVE_SET) {
    const event = { id: 1, side: 'player', move: clip.name, at: 0 };
    const s = { event, clock: 0, status: 'attack' },
      played = [];
    const play = (_, kind) => played.push(kind);
    playCombatTimeline(s, true, play);
    assert.equal(played.length, 0);
    for (const cue of combatCues(event)) {
      s.clock = cue.at;
      s.status = 'paused';
      playCombatTimeline(s, true, play);
      s.status = 'attack';
      playCombatTimeline(s, true, play);
      playCombatTimeline(s, true, play);
    }
    assert.deepEqual(
      played,
      combatCues(event).map((c) => c.kind),
    );
    const muted = { event, clock: clip.duration, status: 'attack' };
    playCombatTimeline(muted, false, play);
    playCombatTimeline(muted, true, play);
    assert.equal(played.length, combatCues(event).length);
  }
});
test('defended throws stay grounded and knockout throws retain their landing pose', () => {
  for (const move of ['Body slam', 'Suplex']) {
    const clip = MOVE_SET.find((m) => m.name === move);
    const blocked = combatPose({ move, defense: 'block' }, 'attacker', clip.contacts[0], 0);
    assert.ok(Math.abs(blocked.rotation) < 0.4);
    const landing = combatPose({ move, knockdown: true }, 'defender', clip.contacts[0], 0);
    const knockout = combatPose(
      { move, knockdown: true, defeated: true },
      'defender',
      clip.contacts[0] + 0.2,
      0,
    );
    assert.deepEqual(knockout, landing);
  }
});

test('correct characters alternate hands, errors and backspace do not punch', () => {
  const s = fighting('Normal', 'Practice');
  typeCharacter(s, s.word[0]);
  assert.equal(s.strikes[0].hand, 'left');
  typeCharacter(s, '~');
  assert.equal(s.strikes.length, 1);
  typeCharacter(s, 'Backspace');
  assert.equal(s.strikes.length, 1);
  typeCharacter(s, s.word[1]);
  assert.equal(s.strikes[1].hand, 'right');
  typeCharacter(s, s.word[2]);
  assert.equal(s.strikes[2].hand, 'left');
  assert.ok(s.strikes[1].at >= s.strikes[0].at + s.strikes[0].duration);
  assert.equal(s.status, 'fighting');
  const sounds = [];
  advanceMatch(s, 0.055);
  playCombatTimeline(s, true, (_, kind, hand) => sounds.push([kind, hand]));
  assert.deepEqual(sounds, [['jab', 0]]);
  advanceMatch(s, 0.14);
  playCombatTimeline(s, true, (_, kind, hand) => sounds.push([kind, hand]));
  assert.deepEqual(sounds, [
    ['jab', 0],
    ['jab', 1],
  ]);
});
test('last kick launches the loser and waits for landing before results', () => {
  const s = fighting('Easy');
  s.enemy.hp = 1;
  s.enemy.stance = 'attack';
  complete(s);
  advanceMatch(s, s.event.at - s.clock + s.event.impactAt);
  assert.equal(s.event.launch, true);
  assert.equal(s.status, 'attack');
  const airborne = combatPose(s.event, 'defender', s.event.impactAt + 0.4, 0);
  assert.ok(airborne.y < -70);
  assert.ok(airborne.x < -50);
  advanceMatch(s, 0.85);
  assert.equal(s.status, 'attack');
  const landed = combatPose(s.event, 'defender', s.event.landingAt + 0.3, 0);
  assert.equal(landed.x, -137);
  assert.equal(landed.y, 43);
  advanceMatch(s, 0.46);
  assert.equal(s.status, 'finished');
  assert.equal(s.winner, 'player');
  assert.ok(combatCues(s.event).some((c) => c.kind === 'slam' && c.at === s.event.landingAt));
});
import { versusMatch, applyAction, snapshot, validSnapshot } from '../src/fight/versus.js';
import { decodeCode } from '../src/fight/peer.js';
test('Versus has no AI input and either human can win a word', () => {
  const s = versusMatch('Easy');
  startMatch(s);
  advanceMatch(s, 3);
  advanceMatch(s, 1);
  assert.equal(s.enemy.total, 0);
  assert.equal(s.player.total, 0);
  assert.equal(s.enemy.stance, 'attack');
  for (const key of s.word)
    applyAction(s, { type: 'key', key, round: s.round, epoch: 1 }, 'enemy', 1);
  assert.equal(s.event.side, 'enemy');
  assert.equal(s.enemy.punches, s.word.length);
});
test('remote actions reject stale rounds, old matches, paste and unknown types', () => {
  const s = versusMatch('Easy');
  startMatch(s);
  advanceMatch(s, 3);
  for (const m of [
    { type: 'key', key: s.word, round: s.round, epoch: 1 },
    { type: 'key', key: s.word[0], round: s.round - 1, epoch: 1 },
    { type: 'key', key: s.word[0], round: s.round, epoch: 0 },
    { type: 'state', state: { winner: 'enemy' }, epoch: 1 },
  ])
    applyAction(s, m, 'enemy', 1);
  assert.equal(s.enemy.total, 0);
  assert.equal(s.winner, null);
  applyAction(s, { type: 'pause', paused: true, epoch: 1 }, 'enemy', 1);
  assert.equal(s.status, 'paused');
  applyAction(s, { type: 'pause', paused: true, epoch: 1 }, 'enemy', 1);
  assert.equal(s.status, 'paused');
  applyAction(s, { type: 'pause', paused: false, epoch: 1 }, 'enemy', 1);
  assert.equal(s.status, 'fighting');
});
test('connection codes and snapshots reject malformed payloads', () => {
  assert.throws(() => decodeCode('bad', 'offer'));
  assert.throws(() =>
    decodeCode(btoa(JSON.stringify({ v: 1, type: 'answer', sdp: 'v=0\r\n' })), 'offer'),
  );
  assert.equal(
    decodeCode(btoa(JSON.stringify({ v: 1, type: 'offer', sdp: 'v=0\r\n' })), 'offer').type,
    'offer',
  );
  const m = snapshot(versusMatch(), 1, false);
  assert.equal(validSnapshot(m), true);
  assert.equal(m.state.random, undefined);
  m.state.strikes = [{ side: 'oops' }];
  assert.equal(validSnapshot(m), false);
});
