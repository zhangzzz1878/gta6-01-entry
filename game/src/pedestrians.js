// Pedestrians: city folk who stroll the sidewalks, scatter when gunfire or
// sirens get close, and react when the player shoves or hits them.

import { PED, WORLD } from './config.js';
import { makeRng, range, int, pick } from './random.js';
import { resolveCircle } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22', '#95a5a6'];
const PANTS = ['#2c3e50', '#5d4037', '#37474f', '#4a235a'];

export function spawnPedestrians(city, seed, count) {
  const rng = makeRng(seed + 303);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const rx = pick(rng, city.roads.v);
    const ry = pick(rng, city.roads.h);
    const x = vertical ? rx + (rng() < 0.5 ? -58 : 58) : range(rng, 240, WORLD.w - 240);
    const y = vertical ? range(rng, 240, WORLD.h - 240) : ry + (rng() < 0.5 ? -58 : 58);
    peds.push({
      x, y,
      angle: rng() * Math.PI * 2,
      radius: 10,
      speed: range(rng, PED.walkMin, PED.walkMax),
      shirt: pick(rng, SHIRTS),
      pants: pick(rng, PANTS),
      target: null,
      fleeing: false,
      fleeUntil: 0,
      scared: 0,
      down: false,
      downUntil: 0,
      walkPhase: rng() * Math.PI * 2,
    });
  }
  return peds;
}

function pickSidewalkTarget(rng, city, p) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const rx = pick(rng, city.roads.v);
    return { x: rx + (rng() < 0.5 ? -58 : 58), y: range(rng, 240, WORLD.h - 240) };
  }
  const ry = pick(rng, city.roads.h);
  return { x: range(rng, 240, WORLD.w - 240), y: ry + (rng() < 0.5 ? -58 : 58) };
}

export function updatePedestrians(peds, city, G, dt, now) {
  const rng = G.rng;
  for (const p of peds) {
    if (p.down) {
      if (now > p.downUntil) { p.down = false; p.fleeing = true; p.fleeUntil = now + 4; }
      continue;
    }
    // Flee from the player when they are shooting, driving at them, or wanted.
    const dPlayer = Math.hypot(G.player.x - p.x, G.player.y - p.y);
    const danger = G.shotsFiredAt > now - 1.2 || (G.wanted > 0 && dPlayer < 220);
    if (danger && dPlayer < 260) {
      p.fleeing = true;
      p.fleeUntil = now + 3;
      p.scared = 1;
    }
    if (p.fleeing && now > p.fleeUntil) p.fleeing = false;
    if (p.fleeing) {
      const away = Math.atan2(p.y - G.player.y, p.x - G.player.x);
      p.angle = away;
      p.x += Math.cos(away) * PED.fleeSpeed * dt;
      p.y += Math.sin(away) * PED.fleeSpeed * dt;
    } else {
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 14) {
        p.target = pickSidewalkTarget(rng, city, p);
      }
      const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      p.angle = want;
      p.x += Math.cos(want) * p.speed * dt;
      p.y += Math.sin(want) * p.speed * dt;
    }
    p.walkPhase += dt * (p.fleeing ? 14 : 8);
    resolveCircle(city, p);
  }
}

export function drawPedestrians(ctx, peds, cam) {
  for (const p of peds) {
    if (p.x < cam.x - 30 || p.x > cam.x + cam.w + 30 || p.y < cam.y - 30 || p.y > cam.y + cam.h + 30) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = Math.sin(p.walkPhase) * 2.5;
    ctx.rotate(p.angle);
    ctx.fillStyle = p.pants;
    ctx.fillRect(-8, -6 + swing * 0.4, 7, 5);
    ctx.fillRect(-8, 1 - swing * 0.4, 7, 5);
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(6, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.scared > 0.3) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 16);
    }
  }
}
