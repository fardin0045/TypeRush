import { fighterPose } from './animator.js';
import { moveClip } from './moves.js';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => ({
  joints: a.joints.map((p, i) => p.map((v, j) => lerp(v, b.joints[i][j], t))),
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  rotation: lerp(a.rotation, b.rotation, t),
});
const pose = (base, changes = {}, x = 0, y = 0, rotation = 0) => ({
  joints: base.joints.map((p, i) => changes[i] || [...p]),
  x,
  y,
  rotation,
});
function sample(frames, time) {
  if (time <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (time <= frames[i][0])
      return blend(
        frames[i - 1][1],
        frames[i][1],
        ease((time - frames[i - 1][0]) / (frames[i][0] - frames[i - 1][0])),
      );
  }
  return frames.at(-1)[1];
}

// Authored paired timelines share the same contact instants as health and sound.
// Coordinates are in each fighter's facing direction; neutral centers are 144px apart.
export function combatPose(event, role, age, clock = 0) {
  const clip = moveClip(event.move),
    base = fighterPose('idle', 0, clock);
  base.x *= 0.28; // Close-range footwork stays inside the opponent's reach.
  const end = clip.duration,
    impact = clip.contacts.at(-1),
    hold = 0.045;
  if (role === 'defender') {
    const first = clip.contacts[0];
    if (event.defeated && age >= impact) {
      const contact = combatPose({ ...event, defeated: false }, role, impact, clock);
      if (event.launch) {
        const flight = clamp((age - impact) / 0.85);
        const airborne = blend(
          contact,
          pose(base, {}, -125, 43, -Math.PI / 2),
          1 - (1 - flight) ** 2,
        );
        airborne.y = lerp(contact.y, 43, flight) - 420 * flight * (1 - flight);
        if (age > event.landingAt) {
          const settle = clamp((age - event.landingAt) / 0.2);
          airborne.x = -125 - 12 * ease(settle);
          airborne.y = 43 - 9 * Math.sin(settle * Math.PI);
        }
        return airborne;
      }
      if (clip.knockdown) return contact;
      const fallen = pose(base, {}, -30, 43, -Math.PI / 2);
      return blend(contact, fallen, ease((age - impact) / 0.23));
    }
    if (event.defense === 'dodge')
      return sample(
        [
          [0, base],
          [Math.max(0, first - 0.13), base],
          [
            first,
            pose(
              base,
              {
                0: [-30, -118],
                1: [-22, -96],
                2: [-10, -48],
                4: [-18, -112],
                6: [18, -108],
                7: [-38, -27],
                9: [25, -25],
              },
              -35,
              0,
              -0.2,
            ),
          ],
          [impact + 0.1, pose(base, {}, -24)],
          [end, base],
        ],
        age,
      );
    if (event.defense === 'block')
      return sample(
        [
          [0, base],
          [
            first - 0.07,
            pose(base, { 3: [22, -100], 4: [25, -153], 5: [39, -105], 6: [39, -146] }, 0),
          ],
          [
            first + 0.04,
            pose(
              base,
              { 3: [22, -100], 4: [25, -153], 5: [39, -105], 6: [39, -146] },
              -12,
              0,
              -0.1,
            ),
          ],
          [end, base],
        ],
        age,
      );
    if (clip.grapple) {
      const captured = pose(
        base,
        {
          3: [-16, -80],
          4: [15, -102],
          5: [34, -91],
          6: [56, -102],
          7: [-18, -28],
          8: [-25, 0],
          9: [17, -31],
          10: [27, 0],
        },
        37,
      );
      const carried = pose(
        base,
        {
          7: [-24, -45],
          8: [-48, -27],
          9: [30, -52],
          10: [53, -35],
          3: [-36, -92],
          4: [-58, -110],
          5: [32, -100],
          6: [60, -114],
        },
        57,
        -65,
        event.move === 'Suplex' ? -1.4 : 1.25,
      );
      const ground = pose(
        base,
        {
          3: [-36, -101],
          4: [-58, -106],
          5: [30, -95],
          6: [50, -111],
          7: [-22, -30],
          8: [-40, -2],
          9: [25, -30],
          10: [45, -4],
        },
        event.move === 'Suplex' ? 174 : -17,
        44,
        event.move === 'Suplex' ? -Math.PI / 2 : Math.PI / 2,
      );
      if (event.move === 'Grab')
        return sample(
          [
            [0, base],
            [0.27, captured],
            [0.42, pose(base, {}, 48, -15, -0.3)],
            [impact, pose(base, {}, -24, 5, -0.35)],
            [impact + hold, pose(base, {}, -28, 5, -0.35)],
            [end, base],
          ],
          age,
        );
      return sample(
        [
          [0, base],
          [0.25, captured],
          [impact * 0.7, carried],
          [impact, ground],
          [impact + 0.1, ground],
          [
            end - 0.12,
            pose(
              base,
              {
                0: [-10, -105],
                1: [-4, -83],
                2: [-8, -41],
                7: [-28, -20],
                8: [-40, 0],
                9: [26, -18],
                10: [42, 0],
              },
              -20,
            ),
          ],
          [end, base],
        ],
        age,
      );
    }
    const recoil = pose(
      base,
      { 0: [-15, -139], 1: [-9, -114], 3: [-34, -88], 4: [-48, -110], 5: [23, -97], 6: [28, -119] },
      -18,
      0,
      -0.17,
    );
    const down = pose(base, {}, -35, 40, -1.5);
    if (event.knockdown)
      return sample(
        [
          [0, base],
          [impact, base],
          [impact + 0.08, recoil],
          [Math.min(end - 0.2, impact + 0.2), down],
          [end - 0.16, down],
          [end, pose(base, {}, -18, 12, -0.35)],
        ],
        age,
      );
    if (clip.contacts.length > 1)
      return sample(
        [
          [0, base],
          [first, base],
          [first + 0.06, recoil],
          [impact - 0.07, base],
          [impact, recoil],
          [impact + hold, recoil],
          [end, base],
        ],
        age,
      );
    return sample(
      [
        [0, base],
        [impact, base],
        [impact + 0.065, recoil],
        [impact + hold + 0.09, recoil],
        [end, base],
      ],
      age,
    );
  }
  const wind = pose(
    base,
    { 0: [-10, -139], 1: [-8, -115], 5: [5, -93], 6: [-6, -121], 7: [-34, -29], 9: [18, -28] },
    -10,
    2,
    -0.08,
  );
  const jab = pose(
    base,
    { 0: [5, -143], 1: [5, -118], 5: [58, -121], 6: [105, -130], 3: [-5, -102], 4: [11, -137] },
    37,
    0,
    0.035,
  );
  const hook = pose(
    base,
    {
      0: [9, -141],
      1: [11, -116],
      5: [60, -146],
      6: [103, -137],
      3: [-18, -109],
      4: [-5, -139],
      2: [4, -63],
    },
    38,
    0,
    0.12,
  );
  const upper = pose(
    base,
    { 0: [7, -147], 1: [8, -123], 5: [57, -116], 6: [102, -150], 7: [-22, -35], 9: [21, -40] },
    40,
    -9,
    0.05,
  );
  const kick = pose(
    base,
    {
      0: [-18, -144],
      1: [-12, -117],
      3: [-40, -100],
      4: [-50, -128],
      5: [21, -111],
      6: [28, -140],
      9: [48, -75],
      10: [111, -111],
      7: [-22, -33],
      8: [-35, 0],
    },
    30,
    0,
    -0.07,
  );
  const chamber = pose(
    base,
    { 9: [30, -66], 10: [17, -36], 5: [20, -107], 6: [29, -139] },
    -7,
    -5,
    -0.15,
  );
  const finish = pose(base, {}, 0);
  let target = jab;
  if (event.move === 'Hook') target = hook;
  if (event.move === 'Uppercut') target = upper;
  if (event.move === 'Power strike') {
    target = hook;
    target.x = 44;
  }
  if (event.move === 'Double punch')
    return sample(
      [
        [0, base],
        [0.12, wind],
        [0.25, jab],
        [0.285, jab],
        [0.38, pose(base, { 3: [8, -110], 4: [24, -140], 5: [20, -100], 6: [17, -130] }, 15)],
        [0.49, hook],
        [0.535, hook],
        [end, finish],
      ],
      age,
    );
  if (event.move === 'Dodge counter' || event.move === 'Block counter') {
    const defensive =
      event.move === 'Dodge counter'
        ? pose(
            base,
            { 0: [-20, -108], 1: [-15, -88], 2: [-8, -43], 7: [-30, -22], 9: [25, -20] },
            -18,
            0,
            -0.13,
          )
        : pose(base, { 3: [18, -112], 4: [23, -151], 5: [36, -107], 6: [40, -148] }, -5);
    return sample(
      [
        [0, base],
        [0.17, defensive],
        [0.3, defensive],
        [impact, jab],
        [impact + hold, jab],
        [end, finish],
      ],
      age,
    );
  }
  if (clip.grapple) {
    const reach = pose(
      base,
      {
        3: [32, -99],
        4: [65, -94],
        5: [44, -113],
        6: [78, -109],
        7: [-18, -27],
        8: [-30, 0],
        9: [28, -28],
        10: [44, 0],
      },
      40,
      6,
    );
    if (event.defense)
      return sample(
        [
          [0, base],
          [0.16, wind],
          [impact, reach],
          [impact + 0.04, reach],
          [end, finish],
        ],
        age,
      );
    if (event.move === 'Grab')
      return sample(
        [
          [0, base],
          [0.14, wind],
          [0.31, reach],
          [
            0.45,
            pose(base, { 3: [18, -80], 4: [37, -86], 5: [30, -99], 6: [53, -88] }, 35, 10, -0.15),
          ],
          [
            impact,
            pose(base, { 5: [56, -106], 6: [98, -102], 3: [28, -94], 4: [70, -88] }, 38, 2, 0.1),
          ],
          [impact + hold, reach],
          [end, finish],
        ],
        age,
      );
    const lift = pose(
      base,
      { 3: [17, -130], 4: [34, -163], 5: [45, -139], 6: [66, -169], 7: [-26, -38], 9: [25, -39] },
      38,
      -15,
      event.move === 'Suplex' ? -0.65 : 0.12,
    );
    const slam =
      event.move === 'Suplex'
        ? pose(
            base,
            {
              3: [-24, -143],
              4: [-45, -170],
              5: [8, -146],
              6: [-12, -179],
              7: [-30, -32],
              9: [28, -29],
            },
            -15,
            28,
            -1.1,
          )
        : pose(
            base,
            {
              0: [25, -118],
              1: [17, -95],
              2: [2, -50],
              3: [40, -70],
              4: [75, -40],
              5: [62, -66],
              6: [98, -35],
              7: [-27, -24],
              9: [26, -24],
            },
            42,
            9,
            0.3,
          );
    return sample(
      [
        [0, base],
        [0.15, wind],
        [0.3, reach],
        [impact * 0.7, lift],
        [impact, slam],
        [impact + 0.08, slam],
        [end - 0.12, pose(base, {}, 8, 10)],
        [end, finish],
      ],
      age,
    );
  }
  if (['Roundhouse', 'Spinning kick', 'Flying kick'].includes(event.move)) {
    if (event.move === 'Flying kick') {
      kick.y = -40;
      kick.x = 33;
      kick.joints[8] = [-60, -23];
    }
    if (event.move === 'Spinning kick')
      return sample(
        [
          [0, base],
          [0.18, chamber],
          [
            0.32,
            pose(
              base,
              { 5: [-27, -105], 6: [-45, -125], 9: [30, -60], 10: [12, -33] },
              10,
              -18,
              -0.38,
            ),
          ],
          [impact, { ...kick, rotation: 0.16 }],
          [impact + hold, { ...kick, rotation: Math.PI * 2 }],
          [end, { ...finish, rotation: Math.PI * 2 }],
        ],
        age,
      );
    return sample(
      [
        [0, base],
        [impact * 0.45, chamber],
        [impact, kick],
        [impact + hold, kick],
        [impact + 0.2, { ...chamber, x: 12, y: -3 }],
        [end - 0.1, pose(base, { 7: [-26, -29], 9: [29, -30] }, 3, 2)],
        [end, finish],
      ],
      age,
    );
  }
  return sample(
    [
      [0, base],
      [impact * 0.48, wind],
      [impact, target],
      [impact + hold, target],
      [end, finish],
    ],
    age,
  );
}
// Short queued strokes preserve every accepted keystroke, including rapid bursts.
export function characterPunchPose(strike, role, age, clock = 0) {
  const base = fighterPose('idle', 0, clock);
  base.x *= 0.28;
  if (role === 'defender')
    return sample(
      [
        [0, base],
        [strike.contact, base],
        [strike.contact + 0.025, pose(base, { 0: [-10, -143], 1: [-5, -117] }, -9, 0, -0.07)],
        [strike.duration, base],
      ],
      age,
    );
  const left = strike.hand === 'left';
  // Rotate the shoulders over planted feet rather than hopping the whole body.
  const joints = left
    ? {
        0: [7, -144],
        1: [9, -118],
        2: [4, -64],
        3: [64, -128],
        4: [128, -135],
        5: [9, -106],
        6: [22, -139],
        7: [-26, -32],
        8: [-40, 0],
        9: [29, -30],
        10: [45, 0],
      }
    : {
        0: [10, -141],
        1: [12, -116],
        2: [7, -63],
        5: [66, -119],
        6: [128, -125],
        3: [-7, -107],
        4: [10, -140],
        7: [-22, -29],
        8: [-36, -2],
        9: [31, -32],
        10: [45, 0],
      };
  const contact = pose(base, joints, 12, -1, left ? -0.025 : 0.045);
  const wind = pose(
    base,
    { 0: [-4, -142], 1: [-3, -116], 2: [-2, -63] },
    -2,
    1,
    left ? 0.025 : -0.025,
  );
  const retract = pose(
    base,
    left ? { 3: [37, -112], 4: [53, -137] } : { 5: [39, -108], 6: [49, -132] },
    5,
    0,
    0,
  );
  return sample(
    [
      [0, base],
      [0.018, wind],
      [strike.contact, contact],
      [strike.contact + 0.012, contact],
      [strike.duration * 0.8, retract],
      [strike.duration, base],
    ],
    age,
  );
}
