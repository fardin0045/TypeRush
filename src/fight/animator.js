const mix = (a, b, t) => a.map((p, i) => p.map((v, j) => v + (b[i][j] - v) * t));
// Joint order: head, neck, hip, left elbow/hand, right elbow/hand,
// left knee/foot, right knee/foot. All limbs are independently posed.
const idle = [
  [0, -142],
  [0, -119],
  [-6, -65],
  [-30, -94],
  [-15, -125],
  [28, -107],
  [40, -133],
  [-29, -34],
  [-43, 0],
  [20, -32],
  [42, 0],
];
export function fighterPose(move, t, clock = 0) {
  const p = idle.map((x) => [...x]);
  // A planted, constantly shifting boxing guard: alternating heel lifts,
  // bent knees, shoulder rolls, head slips and independent hand feints.
  const rhythm = clock * 5.2;
  const weight = Math.sin(rhythm);
  const crouch = (1 - Math.cos(rhythm * 2)) * 2.3;
  const slip = Math.sin(clock * 2.1) * 7;
  p[0] = [slip + weight * 3, -142 + crouch];
  p[1] = [weight * 4, -119 + crouch];
  p[2] = [-6 + weight * 5, -65 + crouch * 0.7];
  p[3] = [-21 + slip * 0.5, -101 + crouch];
  p[4] = [-4 + slip, -137 + crouch + Math.sin(rhythm + 1) * 4];
  p[5] = [29 + weight * 4, -105 + crouch];
  p[6] = [41 + Math.max(0, Math.sin(clock * 2.8)) ** 8 * 15, -135 + Math.cos(rhythm) * 5 + crouch];
  p[7] = [-30 + weight * 6, -32 + crouch];
  p[9] = [23 + weight * 6, -32 + crouch];
  p[8] = [-43 + Math.sin(clock * 1.6) * 8, -Math.max(0, weight) * 5];
  p[10] = [42 + Math.sin(clock * 1.6 + 0.8) * 8, -Math.max(0, -weight) * 5];
  let x = Math.sin(clock * 1.6) * 17 + Math.sin(clock * 0.65) * 8,
    y = 0,
    rotation = 0;
  const drive = Math.sin(Math.PI * Math.min(1, t));
  if (move === 'Punch' || move === 'Power strike' || move === 'Double punch') {
    const hit = move === 'Double punch' ? Math.abs(Math.sin(t * Math.PI * 2)) : drive;
    const target = p.map((a) => [...a]);
    target[5] = [55, -115];
    target[6] = [112, -118];
    target[1] = [10, -116];
    target[0] = [13, -139];
    if (move === 'Double punch' && t > 0.5) {
      target[3] = [55, -108];
      target[4] = [106, -106];
      target[5] = [20, -100];
      target[6] = [30, -125];
    }
    return { joints: mix(p, target, hit), x: x + drive * 53, y, rotation };
  }
  if (move === 'Uppercut') {
    const target = p.map((a) => [...a]);
    target[5] = [35, -139];
    target[6] = [52, -194];
    target[0] = [8, -150];
    target[7] = [-30, -40];
    return {
      joints: mix(p, target, drive),
      x: x + drive * 55,
      y: -drive * 20,
      rotation: drive * 0.15,
    };
  }
  if (['Kick', 'Jumping kick', 'Flying kick', 'Spinning kick', 'Finisher'].includes(move)) {
    const target = p.map((a) => [...a]);
    target[9] = [48, -88];
    target[10] = [115, -103];
    target[0] = [-22, -141];
    target[1] = [-17, -116];
    target[5] = [22, -100];
    target[6] = [40, -122];
    target[3] = [-48, -100];
    target[4] = [-62, -130];
    const air = move !== 'Kick';
    if (air) {
      target[7] = [-40, -53];
      target[8] = [-62, -22];
    }
    x += drive * (move === 'Flying kick' || move === 'Finisher' ? 90 : 45);
    y = air ? -Math.sin(t * Math.PI) * 65 : 0;
    if (move === 'Spinning kick') rotation = t < 0.65 ? (t / 0.65) * Math.PI * 2 : Math.PI * 2;
    if (move === 'Finisher') rotation = t < 0.45 ? (-t / 0.45) * Math.PI * 2 : -Math.PI * 2;
    return { joints: mix(p, target, Math.min(1, drive * 1.5)), x, y, rotation };
  }
  if (move === 'block') {
    p[3] = [18, -103];
    p[4] = [27, -151];
    p[5] = [38, -112];
    p[6] = [39, -151];
    x = -drive * 13;
  }
  if (move === 'dodge') {
    x = -drive * 65;
    y = drive * 20;
    p[0][0] = -25;
    p[1][0] = -20;
    p[7][0] = -40;
    p[9][0] = 20;
    rotation = -drive * 0.25;
  }
  if (move === 'hit') {
    x = -drive * 38;
    rotation = -drive * 0.25;
    p[3] = [-45, -100];
    p[4] = [-62, -124];
    p[6] = [20, -105];
  }
  if (move === 'knockdown') {
    x = -drive * 65;
    y = drive * 24;
    rotation = -drive * 1.35;
  }
  if (move === 'defeat') {
    y = 25;
    rotation = -1.5;
    x = -40;
  }
  if (move === 'victory') {
    p[3] = [-30, -145];
    p[4] = [-38, -190];
    p[5] = [30, -145];
    p[6] = [38, -190];
    y = -Math.abs(Math.sin(clock * 4)) * 7;
  }
  if (move === 'walk') {
    p[8][0] += Math.sin(clock * 8) * 13;
    p[10][0] -= Math.sin(clock * 8) * 13;
  }
  return { joints: p, x, y, rotation };
}
export function blendPose(previous, target, delta) {
  if (!previous) return target;
  const amount = 1 - Math.exp(-Math.max(0, delta) * 18);
  const angle = Math.atan2(
    Math.sin(target.rotation - previous.rotation),
    Math.cos(target.rotation - previous.rotation),
  );
  return {
    joints: mix(previous.joints, target.joints, amount),
    x: previous.x + (target.x - previous.x) * amount,
    y: previous.y + (target.y - previous.y) * amount,
    rotation: previous.rotation + angle * amount,
  };
}
export function drawFighter(
  ctx,
  { x, y, scale, face, color, move, t, clock, reduced, pose: suppliedPose },
) {
  const pose = suppliedPose || fighterPose(move, reduced ? Math.min(t, 0.5) : t, clock);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color + '20';
  ctx.beginPath();
  ctx.ellipse(pose.x * face, 5, 65, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(pose.x * face, pose.y);
  ctx.scale(face, 1);
  ctx.translate(0, -65);
  ctx.rotate(pose.rotation);
  ctx.translate(0, 65);
  const p = pose.joints;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  const limb = (indices) => {
    ctx.beginPath();
    indices.forEach((n, i) => (i ? ctx.lineTo(...p[n]) : ctx.moveTo(...p[n])));
    ctx.stroke();
  };
  ctx.strokeStyle = '#07121e';
  ctx.lineWidth = 15;
  [
    [1, 2],
    [1, 3, 4],
    [1, 5, 6],
    [2, 7, 8],
    [2, 9, 10],
  ].forEach(limb);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  [
    [1, 2],
    [1, 3, 4],
    [1, 5, 6],
    [2, 7, 8],
    [2, 9, 10],
  ].forEach(limb);
  ctx.fillStyle = '#101e2b';
  ctx.beginPath();
  ctx.arc(...p[0], 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#edffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p[0][0] + 5, p[0][1] - 3);
  ctx.lineTo(p[0][0] + 14, p[0][1] - 3);
  ctx.stroke();
  ctx.fillStyle = '#e5ffff';
  for (const n of [3, 5, 7, 9]) {
    ctx.beginPath();
    ctx.arc(...p[n], 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
