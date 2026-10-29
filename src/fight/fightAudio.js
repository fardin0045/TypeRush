import { combatCues } from './moves.js';
let context;
const heard = new WeakMap();
const punchHeard = new WeakMap();
// Use simulation time so pause never leaves scheduled contact sounds playing.
export function playCombatTimeline(match, enabled, play = fightSound) {
  if (['paused', 'ready', 'finished', 'countdown'].includes(match.status)) return;
  const consumed = punchHeard.get(match) || new Set();
  const activeIds = new Set((match.strikes || []).map((p) => p.id));
  for (const id of consumed) if (!activeIds.has(id)) consumed.delete(id);
  for (const stroke of match.strikes || []) {
    const since = match.clock - stroke.at - stroke.contact;
    if (since >= -1e-9 && !consumed.has(stroke.id)) {
      consumed.add(stroke.id);
      if (enabled && since < 0.15) play(true, 'jab', stroke.hand === 'left' ? 0 : 1);
    }
  }
  punchHeard.set(match, consumed);
  if (!match.event?.side || !['attack', 'recovery'].includes(match.status)) return;
  let cursor = heard.get(match);
  if (cursor?.id !== match.event.id) {
    cursor = { id: match.event.id, next: 0 };
    heard.set(match, cursor);
  }
  const age = match.clock - match.event.at,
    cues = combatCues(match.event);
  while (cursor.next < cues.length && cues[cursor.next].at <= age + 1e-9) {
    const cue = cues[cursor.next++];
    if (enabled && age - cue.at < 0.15) play(true, cue.kind, cue.accent || 0);
  }
}
// Body pitch, noise cutoff, decay and weight distinguish every contact.
const profiles = {
  jab: [160, 2300, 0.09, 0.1],
  hook: [105, 1450, 0.14, 0.15],
  uppercut: [125, 1850, 0.18, 0.14],
  roundhouse: [80, 900, 0.22, 0.17],
  flying: [67, 1250, 0.25, 0.18],
  double: [145, 2500, 0.1, 0.11],
  grab: [95, 550, 0.16, 0.09],
  slam: [48, 650, 0.4, 0.23],
  suplex: [38, 950, 0.48, 0.23],
  counter: [175, 2800, 0.12, 0.13],
  parry: [190, 3200, 0.13, 0.13],
  spin: [72, 1750, 0.26, 0.17],
  power: [62, 1200, 0.28, 0.2],
  block: [240, 3700, 0.1, 0.1],
  dodge: [0, 1300, 0.16, 0.035],
  whoosh: [0, 1800, 0.12, 0.025],
  cloth: [0, 650, 0.18, 0.035],
};
export function fightSound(enabled, kind = 'start', accent = 0) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    void context.resume();
    const now = context.currentTime,
      profile = profiles[kind];
    const [pitch, cutoff, duration, weight] = profile || [
      { start: 620, win: 740, lose: 130, combo: 440 }[kind] || 440,
      0,
      0.23,
      0.04,
    ];
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(weight, now + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    envelope.connect(context.destination);
    if (pitch) {
      const body = context.createOscillator();
      body.type = profile ? 'triangle' : 'sine';
      body.frequency.setValueAtTime(pitch * (1 + accent * 0.13), now);
      body.frequency.exponentialRampToValueAtTime(Math.max(25, pitch * 0.32), now + duration);
      body.connect(envelope);
      body.start(now);
      body.stop(now + duration);
      body.onended = () => {
        body.disconnect();
        if (!cutoff) envelope.disconnect();
      };
    }
    if (cutoff) {
      const buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const noise = context.createBufferSource(),
        filter = context.createBiquadFilter();
      noise.buffer = buffer;
      filter.type = pitch ? 'lowpass' : 'bandpass';
      filter.frequency.setValueAtTime(cutoff, now);
      filter.frequency.exponentialRampToValueAtTime(cutoff * 0.35, now + duration);
      filter.Q.value = kind === 'block' ? 2.8 : 0.7;
      noise.connect(filter);
      filter.connect(envelope);
      noise.start(now);
      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        envelope.disconnect();
      };
    }
  } catch {}
}
