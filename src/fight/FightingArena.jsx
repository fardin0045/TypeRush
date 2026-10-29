import React, { useEffect, useRef } from 'react';
import { drawFighter, fighterPose, blendPose } from './animator.js';
import { combatPose, characterPunchPose } from './choreography.js';
export default function FightingArena({ match, reduced }) {
  const canvas = useRef(null),
    latest = useRef({ match, reduced });
  latest.current = { match, reduced };
  useEffect(() => {
    let frame,
      previous = 0,
      visualClock = 0;
    const poses = { player: null, enemy: null };
    const ctx = canvas.current.getContext('2d');
    const paint = (now) => {
      const element = canvas.current;
      if (!element) return;
      const { match: s, reduced: quiet } = latest.current,
        w = element.clientWidth,
        h = element.clientHeight,
        dpr = Math.min(devicePixelRatio || 1, 2);
      const delta = Math.min(0.05, previous ? (now - previous) / 1000 : 0);
      previous = now;
      if (s.status !== 'paused' && !quiet) visualClock += delta;
      if (element.width !== Math.round(w * dpr) || element.height !== Math.round(h * dpr)) {
        element.width = Math.round(w * dpr);
        element.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#10172c');
      sky.addColorStop(0.6, '#162b42');
      sky.addColorStop(1, '#080f1d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const floor = h * 0.72;
      for (let i = 0; i < 30; i++) {
        const x = (i * w) / 27 - 10,
          bh = 45 + ((i * 67) % 150),
          bw = w / 34;
        ctx.fillStyle = i % 2 ? '#0b1425' : '#101d30';
        ctx.fillRect(x, floor - bh, bw, bh);
        ctx.fillStyle = i % 3 ? '#55cbec24' : '#e8629a24';
        for (let k = 0; k < 7; k++)
          for (let j = 0; j < 3; j++)
            ctx.fillRect(x + 6 + j * (bw / 4), floor - bh + 12 + k * 17, 3, 5);
      }
      ctx.strokeStyle = '#59d5ec16';
      ctx.lineWidth = 1;
      for (let i = -8; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + i * 15, floor);
        ctx.lineTo(w * 0.5 + (i * w) / 6, h);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const y = floor + (h - floor) * (i / 5) ** 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#52c5e174';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, floor);
      ctx.lineTo(w, floor);
      ctx.stroke();
      for (const [x, color] of [
        [w * 0.25, '#53dcff'],
        [w * 0.75, '#ff678b'],
      ]) {
        const glow = ctx.createRadialGradient(x, floor, 5, x, floor, w * 0.36);
        glow.addColorStop(0, color + '23');
        glow.addColorStop(1, color + '00');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9bbccc18';
      ctx.font = `900 ${Math.min(96, w * 0.12)}px Arial`;
      ctx.fillText('TYPE / FIGHT', w / 2, h * 0.35);
      const event = s.event,
        age = event ? s.clock - event.at : 0,
        duration = event?.duration || 0.85,
        t = Math.min(1, age / duration);
      const scale = Math.min(w / 650, h / 380, 1.7),
        distance = 72 * scale;
      const moving =
        ['attack', 'recovery'].includes(s.status) ||
        (s.status === 'paused' && ['attack', 'recovery'].includes(s.beforePause));
      const lastContact = event?.contacts?.filter((point) => point <= age).at(-1);
      const sinceContact = lastContact === undefined ? Infinity : age - lastContact;
      let shake =
        !quiet && moving && Number.isFinite(sinceContact) && event?.damage > 0
          ? Math.sin(sinceContact * 110) *
            Math.max(0, 1 - sinceContact / 0.16) *
            (event.knockdown ? 5 : 2.5)
          : 0;
      ctx.save();
      ctx.translate(shake, 0);
      for (const [side, face, color] of [
        ['player', 1, '#65e4ff'],
        ['enemy', -1, '#ff7192'],
      ]) {
        let move = s.status === 'fighting' && s[side].stance !== 'attack' ? s[side].stance : 'idle';
        if (s.status === 'finished') move = s.winner === side ? 'victory' : 'defeat';
        const poseClock = quiet ? 0 : visualClock + (side === 'enemy' ? 1.37 : 0);
        const poseTime =
          s.status === 'recovery' ? 0.9 + ((s.clock - (s.phaseEnd - 0.35)) / 0.35) * 0.1 : t;
        let target = fighterPose(move, quiet ? Math.min(poseTime, 0.5) : poseTime, poseClock);
        target.x *= 0.28;
        if (moving && event?.side)
          target = combatPose(event, event.side === side ? 'attacker' : 'defender', age, poseClock);
        if (s.status === 'finished' && event?.launch && side !== s.winner)
          target = combatPose(event, 'defender', age, 0);
        const stroke = s.strikes?.find(
          (p) => p.side === side && s.clock >= p.at && s.clock < p.at + p.duration,
        );
        const incoming = s.strikes?.find(
          (p) => p.side !== side && s.clock >= p.at && s.clock < p.at + p.duration,
        );
        const characterStroke = stroke || incoming;
        if (characterStroke && (!event?.side || s.clock < event.at))
          target = characterPunchPose(
            characterStroke,
            stroke ? 'attacker' : 'defender',
            s.clock - characterStroke.at,
            poseClock,
          );
        if (quiet && (characterStroke || (moving && event?.side))) {
          target.x *= 0.25;
          target.y *= 0.25;
          target.rotation *= 0.25;
        }
        if (s.status === 'fighting' && !quiet)
          target.x += Math.min(5, (s[side].cursor / Math.max(1, s.word.length)) * 5);
        if (s.status !== 'paused')
          poses[side] =
            moving || characterStroke || quiet ? target : blendPose(poses[side], target, delta);
        drawFighter(ctx, {
          x: w / 2 - face * distance,
          y: floor,
          scale,
          face,
          color,
          move,
          t: s.status === 'recovery' ? 0.9 + ((s.clock - (s.phaseEnd - 0.35)) / 0.35) * 0.1 : t,
          clock: quiet ? 0 : s.clock,
          reduced: quiet,
          pose: poses[side] || target,
        });
      }
      if (moving && event?.side && sinceContact >= 0 && sinceContact < 0.23) {
        const direction = event.side === 'player' ? 1 : -1,
          x =
            event.move === 'Suplex' && !event.defense
              ? w / 2 + direction * (distance - 174 * scale)
              : w / 2 + direction * distance * 0.9,
          y =
            event.knockdown && ['Body slam', 'Suplex'].includes(event.move)
              ? floor - 8 * scale
              : floor - 122 * scale,
          progress = sinceContact / 0.23;
        ctx.globalAlpha = 1 - progress;
        for (let i = 0; i < 14; i++) {
          const angle = i * 2.399,
            spread = (15 + progress * 75) * scale;
          ctx.fillStyle = i % 2 ? '#ffe6a7' : '#fff';
          ctx.fillRect(
            x + Math.cos(angle) * spread,
            y + Math.sin(angle) * spread,
            3 * scale,
            3 * scale,
          );
        }
        ctx.globalAlpha = 1;
        ctx.font = `900 ${28 * scale}px Arial`;
        ctx.fillStyle = event.damage ? '#fff4ba' : '#9ceaff';
        ctx.fillText(
          event.damage ? `−${event.damage}` : event.defense.toUpperCase(),
          x,
          y - 35 * scale - progress * 20,
        );
      }
      ctx.restore();
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="fighting-arena">
      <canvas ref={canvas} aria-label="Two neon stickman fighters on a rooftop arena" />
      <div className="arena-location">
        <i /> ROOFTOP 07 <span>NEON DISTRICT / NIGHT</span>
      </div>
    </div>
  );
}
