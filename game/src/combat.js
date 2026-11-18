// Combat: bullets, muzzle flashes, enemy shooters, punches, and the
// particle bursts that sell every hit. Bullets are simple points with a
// velocity; collision is a radius test against people and cars.

import { PLAYER } from './config.js';
import { addHeat } from './police.js';
import { isSolid } from './city.js';

export function makeCombat() {
  return { bullets: [], enemyBullets: [], particles: [], muzzle: 0 };
}

export function playerShoot(G) {
  const p = G.player;
  if (!p.onFoot || p.ammo <= 0) return;
  p.ammo -= 1;
  const a = G.aimAngle + (G.rng() - 0.5) * 0.05;
  G.combat.bullets.push({
    x: p.x + Math.cos(a) * 18,
    y: p.y + Math.sin(a) * 18,
    vx: Math.cos(a) * 780,
    vy: Math.sin(a) * 780,
    life: 0.7,
    damage: PLAYER.pistolDamage,
  });
  G.combat.muzzle = 0.06;
  G.shotsFiredAt = G.now;
  G.sfxShot();
  addHeat(G, 2); // gunfire draws attention
}

export function enemyShoot(G, x, y, angle, kind) {
  G.combat.enemyBullets.push({
    x: x + Math.cos(angle) * 16,
    y: y + Math.sin(angle) * 16,
    vx: Math.cos(angle) * 520,
    vy: Math.sin(angle) * 520,
    life: 0.9,
    damage: kind === 'cop' ? 7 : 10,
    kind,
  });
  G.sfxEnemyShot();
}

export function playerPunch(G) {
  const p = G.player;
  if (!p.onFoot || p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  G.sfxPunch();
  const px = p.x + Math.cos(p.angle) * 26;
  const py = p.y + Math.sin(p.angle) * 26;
  let hit = false;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - px, e.y - py) < 30) { hurtEnemy(G, e, PLAYER.punchDamage); hit = true; }
  }
  for (const c of G.police.cops) {
    if (c.dead) continue;
    if (Math.hypot(c.x - px, c.y - py) < 30) { hurtCop(G, c, PLAYER.punchDamage); hit = true; }
  }
  for (const pd of G.peds) {
    if (pd.down) continue;
    if (Math.hypot(pd.x - px, pd.y - py) < 26) {
      pd.down = true;
      pd.downUntil = G.now + 3;
      addHeat(G, 12);
      hit = true;
    }
  }
  if (hit) burst(G, px, py, '#ffd23f', 8);
}

export function hurtEnemy(G, e, dmg) {
  e.hp -= dmg;
  burst(G, e.x, e.y, '#ff5a5a', 10);
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    G.cashDrop(e.x, e.y, 40 + Math.floor(G.rng() * 60));
    addHeat(G, 6);
  }
}

export function hurtCop(G, c, dmg) {
  c.hp -= dmg;
  burst(G, c.x, c.y, '#ff5a5a', 10);
  if (c.hp <= 0 && !c.dead) {
    c.dead = true;
    addHeat(G, 30);
    G.toast('You took down a cop. The whole PD will hear about this.', 3);
  }
}

export function burst(G, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2;
    const s = 60 + G.rng() * 160;
    G.combat.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + G.rng() * 0.3,
      maxLife: 0.7,
      color,
      size: 2 + G.rng() * 3,
    });
  }
}

export function updateCombat(G, dt) {
  const c = G.combat;
  if (c.muzzle > 0) c.muzzle -= dt;

  // Player bullets vs enemies, cops, peds, cars — and walls.
  for (const b of c.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (isSolid(G.city, b.x, b.y)) {
      burst(G, b.x, b.y, '#c8c8c8', 4);
      b.life = 0;
    }
    if (b.life <= 0) continue;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < 15) { hurtEnemy(G, e, b.damage); b.life = 0; break; }
    }
    if (b.life <= 0) continue;
    for (const cop of G.police.cops) {
      if (cop.dead) continue;
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) { hurtCop(G, cop, b.damage); b.life = 0; break; }
    }
    if (b.life <= 0) continue;
    for (const pd of G.peds) {
      if (pd.down) continue;
      if (Math.hypot(pd.x - b.x, pd.y - b.y) < 12) {
        pd.down = true;
        pd.downUntil = G.now + 5;
        addHeat(G, 20);
        b.life = 0;
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const car of [...G.cars, ...G.police.cars]) {
      const dx = b.x - car.x;
      const dy = b.y - car.y;
      const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
      const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
      if (Math.abs(localX) < 24 && Math.abs(localY) < 13) {
        car.hp -= b.damage;
        burst(G, b.x, b.y, '#c8c8c8', 6);
        b.life = 0;
        break;
      }
    }
  }
  c.bullets = c.bullets.filter((b) => b.life > 0);

  // Enemy bullets vs the player.
  const p = G.player;
  for (const b of c.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (isSolid(G.city, b.x, b.y)) {
      burst(G, b.x, b.y, '#c8c8c8', 4);
      b.life = 0;
    }
    if (b.life <= 0) continue;
    const target = p.onFoot ? p : p.car;
    const r = p.onFoot ? 14 : 24;
    if (Math.hypot(target.x - b.x, target.y - b.y) < r) {
      if (p.onFoot) {
        p.hp -= b.damage;
        p.lastHurtAt = G.now;
        if (p.hp <= 0) G.wasted = true;
      } else {
        p.car.hp -= b.damage;
        if (p.car.hp <= 0) G.carWrecked = true;
      }
      burst(G, b.x, b.y, '#ff5a5a', 6);
      b.life = 0;
    }
  }
  c.enemyBullets = c.enemyBullets.filter((b) => b.life > 0);

  for (const pt of c.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  c.particles = c.particles.filter((pt) => pt.life > 0);
}

export function drawCombat(ctx, G) {
  const c = G.combat;
  for (const pt of c.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of c.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ff8a5a';
  for (const b of c.enemyBullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (c.muzzle > 0) {
    const p = G.player;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(G.aimAngle) * 30, p.y + Math.sin(G.aimAngle) * 30, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}
