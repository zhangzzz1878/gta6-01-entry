// Solmar Bay city generation and collision.
// The city is a street grid over a 3200x2400 map: vertical and horizontal
// roads every 400 px, buildings inside the blocks, a park, a beach on the
// south shore and a dock strip on the east edge. Everything is placed by the
// seeded RNG, so ?seed=N always rebuilds the same city.

import { WORLD, PALETTE } from './config.js';
import { makeRng, range, int, pick, chance } from './random.js';

export function roadLines() {
  const v = [];
  const h = [];
  for (let x = WORLD.firstRoad; x <= WORLD.w - 200; x += WORLD.roadGap) v.push(x);
  for (let y = WORLD.firstRoad; y <= WORLD.h - 200; y += WORLD.roadGap) h.push(y);
  return { v, h };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const roads = roadLines();
  const buildings = [];
  const parks = [];
  const block = WORLD.roadGap;
  const half = WORLD.roadHalf + WORLD.sidewalk;

  // Named places the missions use; filled in as blocks are laid out.
  const places = {
    mamaLuz: { x: 600, y: 600 },
    market: { x: 1800, y: 1000 },
    garage: { x: 2600, y: 1800 },
    parking: { x: 1400, y: 1400 },
    docks: { x: 3080, y: 1200 },
    airport: { x: 600, y: 1800 },
  };

  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 5; by++) {
      const x0 = WORLD.firstRoad + bx * block + half + 8;
      const y0 = WORLD.firstRoad + by * block + half + 8;
      const x1 = WORLD.firstRoad + (bx + 1) * block - half - 8;
      const y1 = WORLD.firstRoad + (by + 1) * block - half - 8;
      if (y0 > WORLD.beachY - 120) continue; // beach strip, no buildings
      if (x0 > WORLD.dockX - 120) continue; // docks strip, no buildings

      // One central block is the park; one north-west block is Mama Luz's street.
      if (bx === 3 && by === 2) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const isHomeBlock = bx === 1 && by === 1;
      const isMarketBlock = bx === 4 && by === 2;
      const isGarageBlock = bx === 6 && by === 4;
      const isAirportBlock = bx === 1 && by === 4;

      const n = isHomeBlock || isMarketBlock || isGarageBlock || isAirportBlock ? 1 : int(rng, 1, 3);
      for (let i = 0; i < n; i++) {
        const w = range(rng, 90, Math.min(220, x1 - x0 - 20));
        const h = range(rng, 80, Math.min(190, y1 - y0 - 20));
        const x = range(rng, x0, x1 - w);
        const y = range(rng, y0, y1 - h);
        const b = {
          x, y, w, h,
          color: pick(rng, PALETTE.buildingRoof),
          floors: int(rng, 1, 6),
          awning: chance(rng, 0.4),
        };
        buildings.push(b);
        if (isHomeBlock) places.mamaLuz = { x: b.x + b.w / 2, y: b.y + b.h + 26 };
        if (isMarketBlock) places.market = { x: b.x + b.w / 2, y: b.y + b.h + 26 };
        if (isGarageBlock) places.garage = { x: b.x + b.w / 2, y: b.y + b.h + 26 };
        if (isAirportBlock) places.airport = { x: b.x + b.w / 2, y: b.y + b.h + 26 };
      }
    }
  }

  // Palm trees dotted along the beach and around the park.
  const palms = [];
  for (let i = 0; i < 46; i++) {
    palms.push({ x: range(rng, 120, WORLD.w - 120), y: range(rng, WORLD.beachY + 30, WORLD.h - 40) });
  }
  for (let i = 0; i < 10; i++) {
    const p = parks[0];
    if (p) palms.push({ x: range(rng, p.x + 20, p.x + p.w - 20), y: range(rng, p.y + 20, p.y + p.h - 20) });
  }

  return { seed, roads, buildings, parks, palms, places };
}

export function inBeachWater(x, y) {
  return y > WORLD.beachY + 60;
}

export function inDocks(x) {
  return x > WORLD.dockX;
}

// True when the point is inside a building, the sea, or outside the map.
export function isSolid(city, x, y) {
  if (x < 12 || y < 12 || x > WORLD.w - 12 || y > WORLD.h - 12) return true;
  if (inBeachWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// Push a circle (entity with x, y, radius) out of any solid it overlaps.
export function resolveCircle(city, e) {
  const r = e.radius || 12;
  if (e.x < r + 4) e.x = r + 4;
  if (e.y < r + 4) e.y = r + 4;
  if (e.x > WORLD.w - r - 4) e.x = WORLD.w - r - 4;
  if (e.y > WORLD.h - r - 4) e.y = WORLD.h - r - 4;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx;
    const dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      e.x = cx + (dx / d) * r;
      e.y = cy + (dy / d) * r;
    } else if (d2 <= 0.01) {
      e.x = b.x - r - 1;
    }
  }
}

// Nearest point on a road centreline (used to drop cars/peds onto streets).
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roads.v) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of city.roads.h) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

// ---- static city painting (ground, roads, park, beach, docks, buildings) ----
export function drawCity(ctx, city, cam) {
  const { v, h } = city.roads;
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD.w, cam.x + cam.w + 40);
  const y1 = Math.min(WORLD.h, cam.y + cam.h + 40);

  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Mown checker on the grass so the ground reads at a glance.
  ctx.fillStyle = PALETTE.grassDark;
  const cell = 160;
  const cx0 = Math.floor(x0 / cell);
  const cy0 = Math.floor(y0 / cell);
  for (let gx = cx0; gx * cell < x1; gx++) {
    for (let gy = cy0; gy * cell < y1; gy++) {
      if ((gx + gy) % 2 === 0) ctx.fillRect(gx * cell, gy * cell, cell, cell);
    }
  }

  // Beach sand and sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, Math.max(y0, WORLD.beachY), x1 - x0, Math.min(y1, WORLD.h) - Math.max(y0, WORLD.beachY));
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(x0, Math.max(y0, WORLD.beachY + 60), x1 - x0, Math.min(y1, WORLD.h) - Math.max(y0, WORLD.beachY + 60));
  ctx.fillStyle = PALETTE.seaDeep;
  for (let wx = Math.floor(x0 / 220) * 220; wx < x1; wx += 220) {
    ctx.fillRect(wx, WORLD.beachY + 110, 130, 5);
    ctx.fillRect(wx + 60, WORLD.beachY + 160, 110, 5);
  }

  // Docks strip (east edge): wooden pier boards over the water-side quay.
  ctx.fillStyle = PALETTE.dock;
  ctx.fillRect(Math.max(x0, WORLD.dockX), y0, Math.min(x1, WORLD.w) - Math.max(x0, WORLD.dockX), y1 - y0);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let py = Math.floor(y0 / 46) * 46; py < y1; py += 46) {
    ctx.beginPath();
    ctx.moveTo(Math.max(x0, WORLD.dockX), py);
    ctx.lineTo(Math.min(x1, WORLD.w), py);
    ctx.stroke();
  }

  // Park.
  for (const p of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w / 4, p.h / 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sidewalks, then asphalt, then centre dashes.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of v) ctx.fillRect(rx - WORLD.roadHalf - WORLD.sidewalk, y0, (WORLD.roadHalf + WORLD.sidewalk) * 2, y1 - y0);
  for (const ry of h) ctx.fillRect(x0, ry - WORLD.roadHalf - WORLD.sidewalk, x1 - x0, (WORLD.roadHalf + WORLD.sidewalk) * 2);
  ctx.fillStyle = PALETTE.asphalt;
  for (const rx of v) ctx.fillRect(rx - WORLD.roadHalf, y0, WORLD.roadHalf * 2, y1 - y0);
  for (const ry of h) ctx.fillRect(x0, ry - WORLD.roadHalf, x1 - x0, WORLD.roadHalf * 2);

  ctx.fillStyle = PALETTE.asphaltLine;
  for (const rx of v) {
    for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) ctx.fillRect(rx - 2, y, 4, 26);
  }
  for (const ry of h) {
    for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) ctx.fillRect(x, ry - 2, 26, 4);
  }
  // Crosswalk stripes at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of v) {
    for (const ry of h) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rx + i * 11 - 3, ry - WORLD.roadHalf - 8, 6, 8);
        ctx.fillRect(rx + i * 11 - 3, ry + WORLD.roadHalf, 6, 8);
      }
    }
  }

  // Buildings: roof, edge, windows, and a striped awning on shops.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 16, 12);
      }
    }
    if (b.awning) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(b.x + 6, b.y + b.h - 4, b.w - 12, 10);
      ctx.fillStyle = '#f5f5f5';
      for (let ax = b.x + 10; ax < b.x + b.w - 8; ax += 18) ctx.fillRect(ax, b.y + b.h - 4, 8, 10);
    }
  }

  // Palm trees.
  for (const p of city.palms) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 3, p.y - 14);
    ctx.stroke();
    ctx.fillStyle = '#2f8f4f';
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(p.x + 3 + Math.cos(ang) * 9, p.y - 15 + Math.sin(ang) * 7, 11, 4, ang, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
