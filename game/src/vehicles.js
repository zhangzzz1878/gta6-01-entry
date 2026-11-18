// Cars: traffic AI that drives the street grid, parked cars, the player's
// car physics, and stealing (E next to a car). Cars are plain objects so
// police.js can drive cop cars with the same steering.

import { WORLD, CAR, TRAFFIC } from './config.js';
import { makeRng, range, int, pick } from './random.js';
import { isSolid, nearestRoadPoint } from './city.js';

let nextId = 1;

export function makeCar(x, y, angle, color, opts = {}) {
  return {
    id: nextId++,
    x, y, angle,
    speed: 0,
    color,
    hp: opts.hp ?? CAR.maxHp,
    parked: !!opts.parked,
    traffic: !!opts.traffic,
    cop: !!opts.cop,
    target: null, // traffic waypoint {x, y}
    targetSpeed: opts.targetSpeed ?? 0,
    w: 44, h: 22,
    name: opts.name ?? '',
    brakeLight: false,
  };
}

export function spawnTraffic(city, seed, count) {
  const rng = makeRng(seed + 101);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const rx = pick(rng, city.roads.v);
    const ry = pick(rng, city.roads.h);
    const vertical = rng() < 0.5;
    const x = vertical ? rx + (rng() < 0.5 ? -16 : 16) : range(rng, 240, WORLD.w - 240);
    const y = vertical ? range(rng, 240, WORLD.h - 240) : ry + (rng() < 0.5 ? -16 : 16);
    const c = makeCar(x, y, vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI), pick(rng, TRAFFIC.colors), {
      traffic: true,
      targetSpeed: range(rng, TRAFFIC.speedMin, TRAFFIC.speedMax),
    });
    c.target = pickNextIntersection(rng, city, x, y);
    cars.push(c);
  }
  return cars;
}

export function spawnParked(city, seed) {
  const rng = makeRng(seed + 202);
  const cars = [];
  const spots = [
    { x: 1400, y: 1400, color: '#f1c40f', name: 'Sunbeam GT' }, // mission 2 target
    { x: 1000, y: 600, color: '#c0392b' },
    { x: 2200, y: 1000, color: '#2980b9' },
    { x: 600, y: 1400, color: '#7f8c8d' },
    { x: 1800, y: 1800, color: '#8e44ad' },
    { x: 2600, y: 600, color: '#16a085' },
    { x: 2200, y: 2200, color: '#e67e22' },
    { x: 1000, y: 2200, color: '#ecf0f1' },
    { x: 3000, y: 1000, color: '#2c3e50' },
    { x: 600, y: 1000, color: '#d35400' },
  ];
  for (const s of spots) {
    const p = nearestRoadPoint(city, s.x, s.y);
    const vertical = p.vertical;
    const x = vertical ? p.x + 16 : s.x;
    const y = vertical ? s.y : p.y + 16;
    const c = makeCar(x, y, vertical ? Math.PI / 2 : 0, s.color, { parked: true, name: s.name ?? '' });
    cars.push(c);
  }
  return cars;
}

function pickNextIntersection(rng, city, x, y) {
  // Nearest intersection, then one step along the grid in a random direction.
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roads.v) {
    for (const ry of city.roads.h) {
      const d = (rx - x) ** 2 + (ry - y) ** 2;
      if (d < bestD) { bestD = d; best = { x: rx, y: ry }; }
    }
  }
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const [dx, dy] = pick(rng, dirs);
  const nx = best.x + dx * 400;
  const ny = best.y + dy * 400;
  if (nx < 200 || nx > WORLD.w - 200 || ny < 200 || ny > WORLD.h - 200) return best;
  return { x: nx, y: ny };
}

function angleTo(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Steer a car toward a point (used by traffic and by police pursuit).
export function steerToward(car, tx, ty, dt, maxSpeed) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleTo(car.angle, want);
  const turn = Math.max(-1, Math.min(1, diff * 2.2));
  const spd = Math.abs(car.speed);
  car.angle += turn * CAR.turnRate * 0.9 * dt * Math.min(1, spd / 90 + 0.25);
  const accel = car.speed < maxSpeed ? CAR.accel * 0.7 : 0;
  car.speed += accel * dt;
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return Math.abs(diff);
}

// Traffic update: waypoint driving, gentle braking when another car is ahead.
export function updateTraffic(car, cars, city, dt) {
  if (!car.target) car.target = pickNextIntersection(Math.random, city, car.x, car.y);
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    car.target = pickNextIntersection(Math.random, city, car.x, car.y);
    return;
  }
  // Brake if a car is close ahead.
  let ahead = false;
  for (const o of cars) {
    if (o === car) continue;
    const ox = o.x - car.x;
    const oy = o.y - car.y;
    const along = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (along > 0 && along < 70 && side < 30) { ahead = true; break; }
  }
  const maxSpeed = ahead ? 0 : car.targetSpeed;
  steerToward(car, car.target.x, car.target.y, dt, maxSpeed);
  if (ahead && car.speed > 0) car.speed = Math.max(0, car.speed - CAR.brake * dt);
}

// Arcade player driving: throttle, brake/reverse, steering that scales with speed.
export function updatePlayerCar(car, steer, throttle, brake, dt) {
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) car.speed -= CAR.reverseAccel * dt;
  if (brake) {
    if (car.speed > 0) car.speed = Math.max(0, car.speed - CAR.brake * dt);
    else car.speed = Math.min(0, car.speed + CAR.brake * dt);
  }
  car.speed -= car.speed * CAR.drag * dt;
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR.turnRate * dt * dir * Math.min(1, Math.abs(car.speed) / 120 + 0.15);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = brake || throttle < 0;
}

// Keep a car out of buildings and the sea by sliding it back.
export function collideCar(city, car) {
  const half = 24;
  const cx = Math.cos(car.angle);
  const sx = Math.sin(car.angle);
  const corners = [
    { x: car.x + cx * half - sx * 12, y: car.y + sx * half + cx * 12 },
    { x: car.x + cx * half + sx * 12, y: car.y + sx * half - cx * 12 },
    { x: car.x - cx * half - sx * 12, y: car.y - sx * half + cx * 12 },
    { x: car.x - cx * half + sx * 12, y: car.y - sx * half - cx * 12 },
  ];
  let hit = false;
  for (const c of corners) {
    if (isSolid(city, c.x, c.y)) { hit = true; break; }
  }
  if (hit) {
    car.x -= Math.cos(car.angle) * car.speed * 0.03;
    car.y -= Math.sin(car.angle) * car.speed * 0.03;
    if (Math.abs(car.speed) > 120) car.speed *= 0.45;
    else car.speed *= 0.7;
    return true;
  }
  return false;
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Oriented rectangle overlap between two cars (44 long, 22 wide each).
// Cars in neighbouring lanes are 32 px apart laterally, so a circle test
// would constantly false-trigger; the local-frame test only fires on a real
// touch. Returns true on overlap and pushes the two cars apart.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cos = Math.cos(-a.angle);
  const sin = Math.sin(-a.angle);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  if (Math.abs(lx) >= 42 || Math.abs(ly) >= 20) return false;
  const px = 42 - Math.abs(lx);
  const py = 20 - Math.abs(ly);
  if (px < py) {
    const s = lx >= 0 ? 1 : -1;
    const fx = Math.cos(a.angle) * s;
    const fy = Math.sin(a.angle) * s;
    a.x -= (fx * px) / 2;
    a.y -= (fy * px) / 2;
    b.x += (fx * px) / 2;
    b.y += (fy * px) / 2;
  } else {
    const s = ly >= 0 ? 1 : -1;
    const nx = -Math.sin(a.angle) * s;
    const ny = Math.cos(a.angle) * s;
    a.x -= (nx * py) / 2;
    a.y -= (ny * py) / 2;
    b.x += (nx * py) / 2;
    b.y += (ny * py) / 2;
  }
  return true;
}

export function drawCar(ctx, car, isPlayerCar) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(-23, -11, 46, 24);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -22, -11, 44, 22, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  roundRect(ctx, -6, -9, 14, 18, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(8, -8, 3, 16);
  // Headlights / taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(20, -9, 3, 4);
  ctx.fillRect(20, 5, 3, 4);
  ctx.fillStyle = car.brakeLight ? '#ff2e2e' : '#a33';
  ctx.fillRect(-23, -9, 3, 4);
  ctx.fillRect(-23, 5, 3, 4);
  if (car.cop) {
    ctx.fillStyle = '#111';
    ctx.fillRect(-2, -11, 10, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (isPlayerCar) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
