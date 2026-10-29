export const difficulties = {
  Easy: [24, 28, 32],
  Normal: [40, 46, 52],
  Hard: [58, 65, 72],
  Expert: [75, 85, 95],
};
export const passages = [
  [
    'Everyday',
    'The city lights flicker as the last train rolls into the station. Somewhere beyond the skyline, a new adventure is waiting. Take a breath, find your rhythm, and enjoy the ride.',
  ],
  [
    'Flow state',
    'Speed comes from rhythm, not from rushing. Keep your eyes on the road ahead and let your hands find their own pace. Every small improvement brings you closer to the finish line.',
  ],
  [
    'Technology',
    'Great software starts with a simple idea. Break a large problem into small pieces, test each step, and keep learning. The best solution is often the one that everyone can understand.',
  ],
  [
    'Night drive',
    'A cool breeze drifts through the open window. The road curves along the coast as the sun fades into the sea. For a moment, there is only the engine, the ocean, and the open road.',
  ],
  [
    'Precision',
    '"Ready to race?" she asked. The clock read 10:30; three drivers waited at the gate. Focus, breathe, and go! A perfect start is exciting, but a steady pace wins the race.',
  ],
  [
    'Everyday',
    'Fresh coffee fills the kitchen with a familiar smell. Outside, the morning rain has stopped and the garden shines. It is a good day to try something new and see how far you can go.',
  ],
];
export function pickPassage(index, difficulty, length = 'Medium') {
  const pool = difficulty === 'Easy' ? [0, 1, 3, 5] : [0, 1, 2, 3, 4, 5];
  const item = passages[pool[index % pool.length]];
  let text = item[1];
  if (length === 'Short') text = text.split('. ').slice(0, 2).join('. ') + '.';
  if (length === 'Long')
    text += ' ' + passages[(pool[index % pool.length] + 1) % passages.length][1];
  return { category: item[0], text };
}
export function metrics(s) {
  const minutes = s.elapsed / 60;
  return {
    gross: minutes ? s.total / 5 / minutes : 0,
    net: minutes ? Math.max(0, (s.total / 5 - s.errors) / minutes) : 0,
    accuracy: s.total ? (s.correct / s.total) * 100 : 100,
    cpm: minutes ? s.total / minutes : 0,
  };
}
export function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createRace(
  text,
  difficulty = 'Normal',
  seed = 1,
  mode = 'Quick race',
  duration = 30,
) {
  if (!text.trim()) throw new Error('A passage is required');
  const random = seeded(seed);
  return {
    text,
    difficulty,
    mode,
    duration,
    status: 'ready',
    elapsed: 0,
    cursor: 0,
    wrong: '',
    total: 0,
    correct: 0,
    errors: 0,
    winner: null,
    random,
    bots: difficulties[difficulty].map((wpm, i) => ({
      name: ['NOVA', 'APEX', 'GHOST'][i],
      wpm,
      accuracy: 0.94 + i * 0.015,
      cursor: 0,
      total: 0,
      errors: 0,
      next: 0.4 + random() * 0.5,
      recover: false,
    })),
  };
}
export function inputCharacter(s, char) {
  if (s.status !== 'racing') return;
  if (char === 'Backspace') {
    if (s.wrong) s.wrong = '';
    else s.cursor = Math.max(0, s.cursor - 1);
    return;
  }
  if (char.length !== 1) return;
  s.total++;
  if (!s.wrong && char === s.text[s.cursor]) {
    s.correct++;
    s.cursor++;
    if (s.cursor === s.text.length && s.mode !== 'Time trial') finish(s, 'YOU');
  } else {
    s.errors++;
    s.wrong = char;
  }
}
export function finish(s, winner) {
  s.status = 'finished';
  s.winner = winner;
}
export function tick(s, delta) {
  if (s.status !== 'racing') return;
  const end = s.elapsed + delta;
  if (!['Practice', 'Time trial'].includes(s.mode)) {
    while (true) {
      const b = s.bots.reduce((a, b) => (a.next < b.next ? a : b));
      if (b.next > end) break;
      s.elapsed = b.next;
      if (b.recover) b.recover = false;
      else {
        b.total++;
        if (s.random() > b.accuracy) {
          b.errors++;
          b.recover = true;
        } else b.cursor++;
      }
      if (b.cursor >= s.text.length) {
        finish(s, b.name);
        return;
      }
      b.next += (60 / (b.wpm * 5)) * (0.65 + s.random() * 0.7) * (b.recover ? 2.3 : 1);
    }
  }
  s.elapsed = end;
  if (s.mode === 'Time trial' && s.elapsed >= s.duration) {
    s.elapsed = s.duration;
    finish(s, 'YOU');
  }
}
export function standings(s) {
  return [
    { name: 'YOU', cursor: s.cursor, total: s.total, errors: s.errors },
    ...(['Practice', 'Time trial'].includes(s.mode) ? [] : s.bots),
  ].sort((a, b) => b.cursor - a.cursor);
}
