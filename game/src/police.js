// The law: wanted heat, stars, police spawns, pursuit and arrest.
// Heat rises with crimes and cools after a calm stretch; stars are
// floor(heat / 25), capped at 5. Cops chase on foot and in cruisers; a cop
// who stays close to Rico on foot for long enough busts him.

import { POLICE, WANTED, WORLD } from './config.js';
import { makeRng, pick } from './random.js';
import { makeCar, steerToward } from './vehicles.js';
import { resolveCircle } from './city.js';

export function makePoliceState() {
  return { cops: [], cars: [], lastCrimeAt: -999, spawnTimer: 0 };
}

export function starsFromHeat(heat) {
  return Math.min(WANTED.maxStars, Math.floor(heat / WANTED.heatPerStar));
}

export function addHeat(G, amount) {
  G.heat = Math.min(WANTED.maxStars * WANTED.heatPerStar + 24, G.heat + amount);
  G.police.lastCrimeAt = G.now;
  const s = starsFromHeat(G.heat);
  if (s > G.wanted) {
    G.wanted = s;
    G.toast(`WANTED LEVEL ${s} — the Solmar Bay PD is on you!`, 3.5);
  } else {
    G.wanted = s;
  }
}

export function updateWanted(G, dt) {
  const calmFor = G.now - G.police.lastCrimeAt;
  if (calmFor > WANTED.calmSeconds && G.heat > 0) {
    // Heat only cools while no cop can see Rico.
    const seen = G.police.cops.some((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 420)
      || G.police.cars.some((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 420);
    if (!seen) {
      G.heat = Math.max(0, G.heat - WANTED.decayPerSec * dt);
      const s = starsFromHeat(G.heat);
      if (s < G.wanted) {
        G.wanted = s;
        if (s === 0) G.toast('You lost them. The heat is off — for now.', 3);
        else G.toast(`Wanted level dropped to ${s} star${s > 1 ? 's' : ''}.`, 2.5);
      }
    }
  }
}

function spawnCop(G) {
  const rng = G.rng;
  const p = G.player;
  const ang = rng() * Math.PI * 2;
  const dist = POLICE.spawnDistance + rng() * 200;
  let x = p.x + Math.cos(ang) * dist;
  let y = p.y + Math.sin(ang) * dist;
  x = Math.max(40, Math.min(WORLD.w - 40, x));
  y = Math.max(40, Math.min(WORLD.h - 40, y));
  const wantCar = G.wanted >= 2 && G.police.cars.length < 2 + G.wanted && rng() < 0.55;
  if (wantCar) {
    const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), '#1f3a5f', { cop: true, hp: 120 });
    car.targetSpeed = POLICE.carSpeed;
    G.police.cars.push(car);
  } else {
    G.police.cops.push({
      x, y, angle: 0, radius: 11, hp: 60, speed: POLICE.footSpeed,
      arrestTimer: 0, shootCooldown: 1 + rng() * 1.5, dead: false,
    });
  }
}

export function updatePolice(G, dt) {
  const p = G.player;
  const pol = G.police;
  const want = Math.min(1 + G.wanted, 3 + G.wanted);
  const totalCops = pol.cops.filter((c) => !c.dead).length + pol.cars.length;
  pol.spawnTimer -= dt;
  if (G.wanted > 0 && totalCops < want && pol.spawnTimer <= 0) {
    spawnCop(G);
    pol.spawnTimer = 1.6;
  }

  // Foot cops: run at Rico, shoot when close, arrest when touching.
  for (const c of pol.cops) {
    if (c.dead) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    const wantAng = Math.atan2(p.y - c.y, p.x - c.x);
    c.angle = wantAng;
    if (d > 26) {
      c.x += Math.cos(wantAng) * c.speed * dt;
      c.y += Math.sin(wantAng) * c.speed * dt;
      resolveCircle(G.city, c);
    }
    if (p.onFoot && d < POLICE.arrestRange + 6) {
      c.arrestTimer += dt;
      if (c.arrestTimer >= POLICE.arrestTime) {
        G.busted = true;
        return;
      }
    } else {
      c.arrestTimer = Math.max(0, c.arrestTimer - dt * 2);
    }
    // Cops open fire at 2+ stars when Rico is in range and on foot.
    c.shootCooldown -= dt;
    if (G.wanted >= 2 && d < 380 && d > 60 && c.shootCooldown <= 0) {
      c.shootCooldown = 1.4 + G.rng() * 1.2;
      G.enemyShoot(c.x, c.y, wantAng + (G.rng() - 0.5) * 0.35, 'cop');
    }
  }

  // Cop cars: chase and ram the player's car, or the player on foot.
  for (const car of pol.cars) {
    const tx = p.onFoot ? p.x : p.car.x;
    const ty = p.onFoot ? p.y : p.car.y;
    steerToward(car, tx, ty, dt, POLICE.carSpeed);
    const d = Math.hypot(tx - car.x, ty - car.y);
    if (!p.onFoot && d < 46) {
      // Ram: shove the player's car and damage it.
      p.car.x += Math.cos(car.angle) * 60 * dt;
      p.car.y += Math.sin(car.angle) * 60 * dt;
      p.car.hp -= POLICE.ramDamage * dt;
      if (Math.abs(car.speed) > 200 && G.now - (car.lastBump || 0) > 0.8) {
        car.lastBump = G.now;
        G.sfxCrash();
      }
      if (p.car.hp <= 0) G.carWrecked = true;
    }
    if (p.onFoot && d < 30) {
      p.hp -= 26 * dt;
      if (p.hp <= 0) G.wasted = true;
    }
  }
}

export function drawPolice(ctx, G, cam) {
  for (const c of G.police.cops) {
    if (c.dead) continue;
    if (c.x < cam.x - 30 || c.x > cam.x + cam.w + 30 || c.y < cam.y - 30 || c.y > cam.y + cam.h + 30) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(c.angle);
    ctx.fillStyle = '#1f3a5f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dfe8f2';
    ctx.fillRect(-10, -6, 7, 12);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(6, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f3a5f';
    ctx.beginPath();
    ctx.arc(5, 0, 6.5, Math.PI * 0.95, Math.PI * 1.95);
    ctx.fill();
    ctx.restore();
    if (c.arrestTimer > 0.2) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BUSTED?!', c.x, c.y - 20);
    }
  }
  for (const car of G.police.cars) {
    // Cop cars are drawn by the vehicle renderer in main.js; light bar here.
    const blink = Math.floor(G.now * 6) % 2 === 0;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = blink ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-4, -11, 6, 5);
    ctx.fillStyle = blink ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(-4, 6, 6, 5);
    ctx.restore();
  }
}
