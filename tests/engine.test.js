import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRace,
  inputCharacter,
  tick,
  metrics,
  standings,
  pickPassage,
} from '../src/engine.js';
const running = (text = 'abc', difficulty = 'Normal', mode = 'Quick race') =>
  Object.assign(createRace(text, difficulty, 42, mode), { status: 'racing' });
test('mistakes block progress until corrected; backspace is not a typing attempt', () => {
  const s = running();
  inputCharacter(s, 'x');
  inputCharacter(s, 'a');
  assert.equal(s.cursor, 0);
  inputCharacter(s, 'Backspace');
  inputCharacter(s, 'a');
  assert.equal(s.cursor, 1);
  assert.equal(s.total, 3);
  assert.equal(s.errors, 2);
  assert.equal(s.correct, 1);
});
test('complete passage wins once; finished sessions ignore input', () => {
  const s = running();
  for (const c of 'abc') inputCharacter(s, c);
  assert.equal(s.winner, 'YOU');
  assert.equal(s.status, 'finished');
  inputCharacter(s, 'x');
  tick(s, 60);
  assert.equal(s.total, 3);
  assert.equal(s.elapsed, 0);
});
test('empty and repeated backspace never produce negative progress', () => {
  assert.throws(() => createRace('  '));
  const s = running();
  for (let i = 0; i < 20; i++) inputCharacter(s, 'Backspace');
  assert.equal(s.cursor, 0);
  assert.equal(s.total, 0);
});
test('standard gross and error-penalized net WPM', () => {
  assert.deepEqual(metrics({ elapsed: 60, total: 250, correct: 245, errors: 5 }), {
    gross: 50,
    net: 45,
    accuracy: 98,
    cpm: 250,
  });
});
test('AI simulation deterministic across frame sizes and stops on first finish', () => {
  const a = running(),
    b = running();
  tick(a, 60);
  while (b.status === 'racing') tick(b, 0.016);
  assert.equal(a.winner, b.winner);
  assert.equal(a.elapsed, b.elapsed);
  assert.deepEqual(a.bots, b.bots);
  assert.equal(standings(a)[0].cursor, 3);
});
test('higher difficulty is faster with same seed', () => {
  const a = running('a'.repeat(100), 'Easy'),
    b = running('a'.repeat(100), 'Expert');
  tick(a, 100);
  tick(b, 100);
  assert.ok(b.elapsed < a.elapsed);
});
test('practice has no AI progress; trial stops exactly at deadline', () => {
  const a = running('abc', 'Easy', 'Practice');
  tick(a, 100);
  assert.equal(a.status, 'racing');
  assert.equal(a.bots[0].cursor, 0);
  const b = running('abc', 'Easy', 'Time trial');
  tick(b, 100);
  assert.equal(b.elapsed, 30);
  assert.equal(b.status, 'finished');
});
test('punctuation, uppercase and spaces are validated exactly', () => {
  const s = running('A b!');
  for (const c of 'A b!') inputCharacter(s, c);
  assert.equal(s.winner, 'YOU');
  assert.equal(s.errors, 0);
});
test('ready and paused state ignore inputs and time', () => {
  const s = createRace('abc');
  inputCharacter(s, 'a');
  tick(s, 10);
  s.status = 'paused';
  inputCharacter(s, 'a');
  tick(s, 10);
  assert.equal(s.elapsed, 0);
  assert.equal(s.cursor, 0);
});
test('all passage options are nonempty and varied', () => {
  for (const d of ['Easy', 'Normal', 'Hard', 'Expert'])
    for (const len of ['Short', 'Medium', 'Long']) {
      assert.ok(pickPassage(0, d, len).text.length > 30);
      assert.notEqual(pickPassage(0, d, len).text, pickPassage(1, d, len).text);
    }
});
