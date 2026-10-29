// One timeline drives word selection, choreography, damage contact and audio.
export const MOVE_SET = [
  {
    name: 'Jab',
    words: ['jab', 'quick jab', 'precise jab', 'lightning jab'],
    damage: 11,
    duration: 0.68,
    contacts: [0.23],
    sound: 'jab',
  },
  {
    name: 'Hook',
    words: ['hook', 'left hook', 'tight hook', 'turn the hook'],
    damage: 13,
    duration: 0.83,
    contacts: [0.34],
    sound: 'hook',
  },
  {
    name: 'Uppercut',
    words: ['rise', 'uppercut', 'rising fist', 'rising uppercut'],
    damage: 14,
    duration: 0.92,
    contacts: [0.36],
    sound: 'uppercut',
  },
  {
    name: 'Roundhouse',
    words: ['sweep', 'roundhouse', 'roundhouse kick', 'turn and strike'],
    damage: 14,
    duration: 1.02,
    contacts: [0.43],
    sound: 'roundhouse',
  },
  {
    name: 'Flying kick',
    words: ['fly', 'flying kick', 'airborne kick', 'flying impact'],
    damage: 16,
    duration: 1.08,
    contacts: [0.47],
    sound: 'flying',
  },
  {
    name: 'Double punch',
    words: ['pair', 'one two', 'double strike', 'double impact'],
    damage: 14,
    duration: 0.93,
    contacts: [0.25, 0.49],
    sound: 'double',
  },
  {
    name: 'Grab',
    words: ['grab', 'clinch', 'close clinch', 'clinch and throw'],
    damage: 13,
    duration: 1.12,
    contacts: [0.31, 0.64],
    sound: 'grab',
    grapple: true,
  },
  {
    name: 'Body slam',
    words: ['slam', 'body slam', 'lift and slam', 'heavy body slam'],
    damage: 16,
    duration: 1.4,
    contacts: [0.82],
    sound: 'slam',
    grapple: true,
    knockdown: true,
  },
  {
    name: 'Suplex',
    words: ['throw', 'suplex', 'arching throw', 'bridge suplex'],
    damage: 16,
    duration: 1.5,
    contacts: [0.89],
    sound: 'suplex',
    grapple: true,
    knockdown: true,
  },
  {
    name: 'Dodge counter',
    words: ['slip', 'slip counter', 'duck and strike', 'slip the counter'],
    damage: 12,
    duration: 1.05,
    contacts: [0.58],
    sound: 'counter',
  },
  {
    name: 'Block counter',
    words: ['guard', 'guard counter', 'catch and strike', 'guard then strike'],
    damage: 12,
    duration: 1.02,
    contacts: [0.56],
    sound: 'parry',
  },
  {
    name: 'Spinning kick',
    words: ['spin', 'spin kick', 'spinning kick', 'spin to impact'],
    damage: 15,
    duration: 1.15,
    contacts: [0.55],
    sound: 'spin',
  },
  {
    name: 'Power strike',
    words: ['power', 'power strike', 'heavy strike', 'full force strike'],
    damage: 15,
    duration: 0.94,
    contacts: [0.39],
    sound: 'power',
  },
];
export function moveClip(name) {
  return MOVE_SET.find((m) => m.name === name) || MOVE_SET[0];
}
export const LEVEL_INDEX = { Easy: 0, Normal: 1, Hard: 2, Expert: 3 };
export function combatCues(event) {
  const clip = moveClip(event.move);
  const cues = [
    { at: Math.max(0.05, clip.contacts[0] - 0.13), kind: clip.grapple ? 'cloth' : 'whoosh' },
  ];
  if (event.move === 'Block counter') cues.push({ at: 0.18, kind: 'block' });
  if (event.move === 'Dodge counter') cues.push({ at: 0.18, kind: 'dodge' });
  clip.contacts.forEach((at, i) =>
    cues.push({
      at,
      kind: event.defense === 'dodge' ? 'dodge' : event.defense === 'block' ? 'block' : clip.sound,
      accent: i,
    }),
  );
  if (event.launch) cues.push({ at: event.landingAt, kind: 'slam' });
  return cues.sort((a, b) => a.at - b.at);
}
